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
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';

import { AircraftState } from '../../../models/aircraft.model';
import { LAND } from '../../../shared/world';

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
/** Width of the tracked-aircraft card over the globe's left side (CSS pixels, incl. margin). */
const DETAIL_CARD_WIDTH = 356;
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
  ctx.shadowColor = 'rgba(255, 199, 44, 0.8)';
  ctx.shadowBlur = blur;
  ctx.fillStyle = selected ? '#ffe27a' : '#ffc72c';
  ctx.fill(PLANE);

  spriteCache.set(key, sprite);
  return sprite;
}

/** Origin → destination of the tracked aircraft, as [longitude, latitude]. */
export interface RouteLine {
  from: [number, number];
  to: [number, number];
  fromLabel: string;
  toLabel: string;
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
  /** Route of the selected aircraft, drawn when it is being tracked. */
  readonly route = input<RouteLine | null>(null);
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
  /** Horizontal shift of the globe, so the tracked-aircraft card doesn't cover the route. */
  private offsetX = 0;
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
      this.route();
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
    const focus = plane ? this.focusPoint(plane) : null;
    const tracking = !!plane && this.layout() === 'centered';
    const targetLat = focus ? Math.max(-70, Math.min(70, -focus[1])) : TILT_DEG;
    const targetZoom = tracking ? this.trackZoom(plane!, focus!) : 1;
    // Only shift when the stage is wide enough for the card and the globe side by side.
    const targetOffset = tracking && this.width >= 640 ? Math.min(DETAIL_CARD_WIDTH / 2, this.width * 0.2) : 0;
    if (focus) this.rotLon += lonDelta(-focus[0] - this.rotLon) * k;
    this.rotLat += (targetLat - this.rotLat) * k;
    this.zoom += (targetZoom - this.zoom) * k;
    this.offsetX += (targetOffset - this.offsetX) * k;
  }

  /** Where to centre the view: the middle of the route if known, else the plane. */
  private focusPoint(plane: Plane): [number, number] {
    const route = this.route();
    return route ? geoInterpolate(route.from, route.to)(0.5) : [plane.lon, plane.lat];
  }

  /**
   * Zoom for a tracked plane: close in, but pulled back far enough that the
   * plane and both ends of its route stay on screen. A point at angle θ from the
   * view centre sits at sin(θ) × radius, so zoom must stay below ~0.85 / sin(θ).
   */
  private trackZoom(plane: Plane, focus: [number, number]): number {
    const route = this.route();
    if (!route) return TRACK_ZOOM;
    const farthest = Math.max(
      geoDistance(focus, [plane.lon, plane.lat]),
      geoDistance(focus, route.from),
      geoDistance(focus, route.to),
    );
    if (farthest >= Math.PI / 2) return 1;
    return Math.max(1, Math.min(TRACK_ZOOM, 0.85 / Math.sin(farthest)));
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
      .translate([this.centre[0] + this.offsetX, this.centre[1]])
      .rotate([this.rotLon, this.rotLat]);
    const path = geoPath(projection, ctx);
    const [cx, cy] = projection.translate();
    const r = projection.scale();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // Ocean: plain dark, like a radar or departures-board screen.
    const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, '#18181b');
    ocean.addColorStop(1, '#0d0d0f');
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = ocean;
    ctx.fill();

    // Graticule
    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = 'rgba(200, 194, 180, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Land
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = 'rgba(200, 194, 180, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 194, 180, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Rim
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.strokeStyle = 'rgba(200, 194, 180, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    this.drawRoute(ctx, projection, path);
    this.drawPlanes(ctx, projection);
  }

  /** Great-circle route: solid for the part flown, dashed for the rest, with labelled airports. */
  private drawRoute(
    ctx: CanvasRenderingContext2D,
    projection: ReturnType<typeof geoOrthographic>,
    path: ReturnType<typeof geoPath>,
  ): void {
    const route = this.route();
    const plane = this.trackedPlane();
    if (!route || !plane) return;
    const here: [number, number] = [plane.lon, plane.lat];

    ctx.save();
    ctx.lineCap = 'round';

    ctx.beginPath();
    path({ type: 'LineString', coordinates: [route.from, here] });
    ctx.strokeStyle = 'rgba(255, 199, 44, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    path({ type: 'LineString', coordinates: [here, route.to] });
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255, 199, 44, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);

    // Airports on the far side of the globe are hidden.
    const [rotLon, rotLat] = projection.rotate();
    const viewCentre: [number, number] = [-rotLon, -rotLat];
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const [point, label] of [
      [route.from, route.fromLabel],
      [route.to, route.toLabel],
    ] as [[number, number], string][]) {
      if (geoDistance(point, viewCentre) > Math.PI / 2 - 0.02) continue;
      const pos = projection(point);
      if (!pos) continue;
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0b0c';
      ctx.fill();
      ctx.strokeStyle = '#ffc72c';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (label) {
        ctx.fillStyle = 'rgba(14, 14, 16, 0.85)';
        const width = ctx.measureText(label).width + 10;
        ctx.fillRect(pos[0] - width / 2, pos[1] - 26, width, 16);
        ctx.fillStyle = '#ffe27a';
        ctx.fillText(label, pos[0], pos[1] - 14);
      }
    }
    ctx.restore();
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
      // Fade the other planes, more so while a route is drawn, so it stands out.
      if (selectedId && !isSelected) alpha *= this.route() ? 0.2 : 0.4;
      this.hits.push({ id: p.id, x: pos[0], y: pos[1] });

      ctx.globalAlpha = alpha;

      if (tail) {
        const trail = ctx.createLinearGradient(tail[0], tail[1], pos[0], pos[1]);
        trail.addColorStop(0, 'rgba(255, 199, 44, 0)');
        trail.addColorStop(1, `rgba(255, 199, 44, ${isSelected ? 0.9 : 0.55})`);
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
        ctx.strokeStyle = `rgba(255, 199, 44, ${0.7 * (1 - phase)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 199, 44, 0.5)';
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
