import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-110m.json';

import { AircraftState } from '../../../models/aircraft.model';

const topology = landTopology as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topology, topology.objects.land) as unknown as Feature<MultiPolygon>;
const GRATICULE = geoGraticule10();

const EARTH_RADIUS_M = 6_371_000;
/** Aircraft move at their real speed, so the globe matches where they actually are. */
const TIME_SCALE = 1;
/**
 * Positions are advanced from their OpenSky timestamp to now, but by no more
 * than this, so an old snapshot doesn't fling planes far off course.
 */
const MAX_EXTRAPOLATE_S = 30 * 60;
/** Globe spin, degrees per second. */
const SPIN_DEG_PER_S = 3;
const TILT_DEG = -18;
const TRAIL_DEG = 1.6;
/** How far the centred globe zooms in on a tracked aircraft. */
const TRACK_ZOOM = 2.2;
/** Click tolerance around a plane, in CSS pixels. */
const HIT_RADIUS = 16;
/** Pointer movement, in CSS pixels, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** Seconds after a drag before the globe starts spinning again. */
const IDLE_RESUME_S = 4;

/** Same silhouette as the logo: 24×24, nose pointing up. */
const PLANE = new Path2D(
  'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
);

/**
 * Canvas `shadowBlur` is very slow to redraw every frame, so each glowing plane
 * is rendered once into an offscreen sprite and stamped with drawImage.
 */
const spriteCache = new Map<string, HTMLCanvasElement>();

function planeSprite(size: number, selected: boolean, dpr: number): HTMLCanvasElement {
  const key = `${size}|${selected}|${dpr}`;
  let sprite = spriteCache.get(key);
  if (sprite) return sprite;

  const blur = selected ? 16 : 10; // canvas pixels, as shadowBlur ignores transforms
  const px = size * dpr;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = Math.ceil(px + blur * 2);
  const ctx = sprite.getContext('2d')!;
  ctx.translate(blur, blur);
  ctx.scale(px / 24, px / 24);
  ctx.shadowColor = 'rgba(245, 184, 61, 0.8)';
  ctx.shadowBlur = blur;
  ctx.fillStyle = selected ? '#ffd98a' : '#f5b83d';
  ctx.fill(PLANE);

  spriteCache.set(key, sprite);
  return sprite;
}

interface Plane {
  id: string;
  lon: number;
  lat: number;
  heading: number; // degrees clockwise from north
  speed: number; // m/s
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
/** Shortest signed difference between two longitudes. */
const lonDelta = (d: number) => ((d + 540) % 360) - 180;

/** Point reached from [lon, lat] after travelling `distDeg` degrees of arc on `bearing`. */
function destination(lon: number, lat: number, bearing: number, distDeg: number): [number, number] {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const θ = toRad(bearing);
  const δ = toRad(distDeg);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [((toDeg(λ2) + 540) % 360) - 180, toDeg(φ2)];
}

/**
 * Rotating globe that plots the real aircraft positions it is given and moves
 * them along their reported heading and speed.
 *
 * - `layout="hero"`: large, off-centre, decorative background.
 * - `layout="centered"`: fits its box; with `interactive`, the globe can be dragged,
 *   planes are clickable and the globe locks onto the `selected` aircraft.
 */
@Component({
  selector: 'app-globe',
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: `
    :host { display: block; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
  host: { '[style.pointer-events]': "interactive() ? 'auto' : 'none'" },
})
export class Globe {
  readonly aircraft = input<AircraftState[]>([]);
  readonly selected = input<string | null>(null);
  readonly layout = input<'hero' | 'centered'>('hero');
  readonly interactive = input(false, { transform: booleanAttribute });
  /** Emits the icao24 of a clicked plane, or null when empty space is clicked. */
  readonly planeSelected = output<string | null>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly projection = geoOrthographic().clipAngle(90).precision(0.5);
  private planes: Plane[] = [];
  private hits: { id: string; x: number; y: number }[] = [];
  private rotLon = 0;
  private rotLat = TILT_DEG;
  private zoom = 1;
  private time = 0;
  private dragging = false;
  /** `time` at which the idle spin resumes after a drag. */
  private resumeAt = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private baseRadius = 1;
  private centre: [number, number] = [0, 0];

  constructor() {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let visibility: IntersectionObserver | undefined;
    // Only animate while the globe is on screen.
    let onScreen = true;

    effect(() => {
      const nowS = Date.now() / 1000;
      this.planes = this.aircraft()
        .filter((a) => !a.on_ground && a.longitude != null && a.latitude != null)
        .map((a) => {
          const heading = a.true_track ?? 0;
          const speed = a.velocity ?? 0;
          // Move each plane from where it was reported to where it should be now.
          const ageS = a.time_position != null ? Math.min(Math.max(nowS - a.time_position, 0), MAX_EXTRAPOLATE_S) : 0;
          const [lon, lat] = destination(a.longitude!, a.latitude!, heading, toDeg((speed * ageS) / EARTH_RADIUS_M));
          return { id: a.icao24, lon, lat, heading, speed };
        });
      if (reducedMotion) this.draw();
    });

    // Without animation, jump straight to the selected aircraft.
    effect(() => {
      this.selected();
      if (!reducedMotion) return;
      this.aim(1);
      this.draw();
    });

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      observer = new ResizeObserver(() => {
        this.resize(canvas);
        if (reducedMotion) this.draw();
      });
      observer.observe(canvas);
      this.resize(canvas);

      if (this.interactive()) {
        // Drag to rotate. A drag stops following the selected plane, and the
        // idle spin waits a moment after release so the view stays put.
        let drag: { x: number; y: number; moved: boolean } | null = null;
        let suppressClick = false;
        canvas.style.touchAction = 'none';

        canvas.addEventListener('pointerdown', (e) => {
          drag = { x: e.clientX, y: e.clientY, moved: false };
          canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', (e) => {
          if (!drag) {
            canvas.style.cursor = this.hitTest(e) ? 'pointer' : 'grab';
            return;
          }
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          if (!drag.moved) {
            drag.moved = true;
            this.dragging = true;
            canvas.style.cursor = 'grabbing';
            if (this.selected()) this.planeSelected.emit(null);
          }
          const degPerPx = toDeg(1 / this.projection.scale());
          this.rotLon += dx * degPerPx;
          this.rotLat = Math.max(-90, Math.min(90, this.rotLat - dy * degPerPx));
          drag.x = e.clientX;
          drag.y = e.clientY;
          if (reducedMotion) this.draw();
        });
        const endDrag = () => {
          if (drag?.moved) {
            suppressClick = true;
            this.resumeAt = this.time + IDLE_RESUME_S;
          }
          drag = null;
          this.dragging = false;
          canvas.style.cursor = 'grab';
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);

        canvas.addEventListener('click', (e) => {
          if (suppressClick) {
            suppressClick = false;
            return;
          }
          this.planeSelected.emit(this.hitTest(e));
        });
      }

      if (reducedMotion) {
        this.draw();
        return;
      }

      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1); // clamp after a background tab
        last = now;
        this.step(dt);
        this.draw();
        frame = onScreen ? requestAnimationFrame(tick) : 0;
      };

      visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen && !frame) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      });
      visibility.observe(canvas);
      frame = requestAnimationFrame(tick);
    });

    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      visibility?.disconnect();
    });
  }

  private resize(canvas: HTMLCanvasElement): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = canvas.clientWidth;
    this.height = canvas.clientHeight;
    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);

    if (this.layout() === 'centered') {
      this.baseRadius = Math.min(this.width, this.height) * 0.42;
      this.centre = [this.width / 2, this.height / 2];
    } else if (this.width >= 900) {
      // Desktop hero: large globe to the right of the copy.
      this.baseRadius = Math.min(this.height * 0.58, this.width * 0.36);
      this.centre = [this.width * 0.7, this.height * 0.54];
    } else {
      // Mobile hero: rising from the bottom.
      this.baseRadius = this.width * 0.72;
      this.centre = [this.width / 2, this.height * 0.86];
    }
  }

  private step(dt: number): void {
    this.time += dt;
    for (const p of this.planes) {
      const distDeg = toDeg((p.speed * dt * TIME_SCALE) / EARTH_RADIUS_M);
      [p.lon, p.lat] = destination(p.lon, p.lat, p.heading, distDeg);
    }
    // Leave the view where the user dragged it for a moment before spinning again.
    if (this.dragging || this.time < this.resumeAt) return;
    if (!this.trackedPlane()) this.rotLon = (this.rotLon + SPIN_DEG_PER_S * dt) % 360;
    this.aim(1 - Math.exp(-dt * 3));
  }

  /** Eases rotation/zoom toward the tracked plane (or the idle view) by fraction `k`. */
  private aim(k: number): void {
    const plane = this.trackedPlane();
    const targetLat = plane ? Math.max(-70, Math.min(70, -plane.lat)) : TILT_DEG;
    const targetZoom = plane && this.layout() === 'centered' ? TRACK_ZOOM : 1;
    if (plane) this.rotLon += lonDelta(-plane.lon - this.rotLon) * k;
    this.rotLat += (targetLat - this.rotLat) * k;
    this.zoom += (targetZoom - this.zoom) * k;
  }

  private trackedPlane(): Plane | undefined {
    const id = this.selected();
    return id ? this.planes.find((p) => p.id === id) : undefined;
  }

  private hitTest(e: MouseEvent): string | null {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: string | null = null;
    let bestDist = HIT_RADIUS;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = h.id;
      }
    }
    return best;
  }

  private draw(): void {
    if (!this.width) return; // not sized yet (canvas may not exist)
    const ctx = this.canvas().nativeElement.getContext('2d');
    if (!ctx) return;

    const projection = this.projection
      .scale(this.baseRadius * this.zoom)
      .translate(this.centre)
      .rotate([this.rotLon, this.rotLat]);
    const path = geoPath(projection, ctx);
    const [cx, cy] = this.centre;
    const r = projection.scale();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // Atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
    glow.addColorStop(0, 'rgba(57, 135, 229, 0.22)');
    glow.addColorStop(1, 'rgba(57, 135, 229, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 1.25, cy - r * 1.25, r * 2.5, r * 2.5);

    // Ocean
    const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, '#15233d');
    ocean.addColorStop(1, '#080d17');
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = ocean;
    ctx.fill();

    // Graticule
    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Land
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Rim
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    this.drawPlanes(ctx, projection);
  }

  private drawPlanes(ctx: CanvasRenderingContext2D, projection: ReturnType<typeof geoOrthographic>): void {
    const [rotLon, rotLat] = projection.rotate();
    const viewCentre: [number, number] = [-rotLon, -rotLat];
    const size = Math.max(10, Math.min(16, this.baseRadius / 28));
    const selectedId = this.selected();
    this.hits = [];

    // Draw the tracked plane last so it sits on top.
    const ordered = selectedId
      ? [...this.planes.filter((p) => p.id !== selectedId), ...this.planes.filter((p) => p.id === selectedId)]
      : this.planes;

    for (const p of ordered) {
      // Hide planes on the far side; fade them near the edge of the globe.
      const angle = geoDistance([p.lon, p.lat], viewCentre);
      let alpha = Math.min(1, Math.max(0, (Math.PI / 2 - angle) / 0.25));
      if (alpha <= 0) continue;

      const pos = projection([p.lon, p.lat]);
      const ahead = projection(destination(p.lon, p.lat, p.heading, 0.3));
      const tail = projection(destination(p.lon, p.lat, p.heading + 180, TRAIL_DEG));
      if (!pos || !ahead) continue;

      const isSelected = p.id === selectedId;
      if (selectedId && !isSelected) alpha *= 0.4;
      this.hits.push({ id: p.id, x: pos[0], y: pos[1] });

      ctx.globalAlpha = alpha;

      if (tail) {
        const trail = ctx.createLinearGradient(tail[0], tail[1], pos[0], pos[1]);
        trail.addColorStop(0, 'rgba(245, 184, 61, 0)');
        trail.addColorStop(1, `rgba(245, 184, 61, ${isSelected ? 0.9 : 0.55})`);
        ctx.beginPath();
        ctx.moveTo(tail[0], tail[1]);
        ctx.lineTo(pos[0], pos[1]);
        ctx.strokeStyle = trail;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      }

      if (isSelected) {
        // Expanding lock-on ring
        const phase = (this.time % 1.6) / 1.6;
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 12 + phase * 22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 184, 61, ${0.7 * (1 - phase)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 184, 61, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const sprite = planeSprite(isSelected ? size * 1.6 : size, isSelected, this.dpr);
      const half = sprite.width / this.dpr / 2;
      ctx.save();
      ctx.translate(pos[0], pos[1]);
      ctx.rotate(Math.atan2(ahead[1] - pos[1], ahead[0] - pos[0]) + Math.PI / 2);
      ctx.drawImage(sprite, -half, -half, half * 2, half * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
