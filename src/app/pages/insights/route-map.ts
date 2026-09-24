import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { geoAzimuthalEquidistant, geoGraticule10, geoPath } from 'd3-geo';

import { RouteInsight } from '../../models/insights.model';
import { LAND } from '../../shared/world';

const WIDTH = 800;
const HEIGHT = 440;
const PADDING = 44;
/** Destinations with fewer flights are faded: too few to judge. */
const MIN_FLIGHTS = 3;
/** How many of the busiest destinations get a text label on the map. */
const LABELLED = 6;

type Tone = 'good' | 'fair' | 'poor';

interface Destination {
  route: RouteInsight;
  x: number;
  y: number;
  path: string;
  radius: number;
  tone: Tone;
  thin: boolean;
  labelled: boolean;
}

/**
 * Routes from one airport on a map centred on it (azimuthal equidistant, so
 * each route runs straight out from the centre and distances are true to
 * scale). Destinations are coloured by how many flights to them left on time.
 */
@Component({
  selector: 'app-route-map',
  imports: [DecimalPipe],
  template: `
    <div class="map">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()">
        <path class="map__graticule" [attr.d]="graticulePath()" />
        <path class="map__land" [attr.d]="landPath()" />

        @for (d of destinations(); track d.route.arrival_iata) {
          <path class="map__route map__route--{{ d.tone }}" [class.map__route--thin]="d.thin" [class.map__route--active]="hovered() === d" [attr.d]="d.path" />
        }

        @for (d of destinations(); track d.route.arrival_iata) {
          <circle
            class="map__dot map__dot--{{ d.tone }}"
            [class.map__dot--thin]="d.thin"
            [attr.cx]="d.x"
            [attr.cy]="d.y"
            [attr.r]="d.radius"
            tabindex="0"
            [attr.aria-label]="describe(d)"
            (mouseenter)="hovered.set(d)"
            (mouseleave)="hovered.set(null)"
            (focus)="hovered.set(d)"
            (blur)="hovered.set(null)"
          />
          @if (d.labelled) {
            <text class="map__label" [attr.x]="d.x + d.radius + 5" [attr.y]="d.y + 4">{{ d.route.arrival_iata }}</text>
          }
        }

        @if (origin(); as o) {
          <circle class="map__origin-ring" [attr.cx]="o.x" [attr.cy]="o.y" r="11" />
          <circle class="map__origin" [attr.cx]="o.x" [attr.cy]="o.y" r="6" />
          <text class="map__origin-label" [attr.x]="o.x" [attr.y]="o.y - 18">{{ code() }}</text>
        }
      </svg>

      @if (hovered(); as d) {
        <div class="map__tip" [style.left.%]="(d.x / width) * 100" [style.top.%]="(d.y / height) * 100">
          <b>{{ d.route.arrival_iata }}</b> {{ d.route.arrival_airport }}
          <span>{{ d.route.on_time_pct | number: '1.0-0' }}% on time · {{ d.route.flights }} {{ d.route.flights === 1 ? 'flight' : 'flights' }}</span>
          <span>average delay {{ d.route.avg_delay_min | number: '1.0-0' }} min</span>
        </div>
      }
    </div>

    <ul class="legend">
      <li><i class="legend__dot legend__dot--good"></i>80%+ on time</li>
      <li><i class="legend__dot legend__dot--fair"></i>60–79%</li>
      <li><i class="legend__dot legend__dot--poor"></i>Under 60%</li>
      <li class="legend__note">Bigger dot = more flights · faded: fewer than {{ minFlights }} flights</li>
    </ul>
  `,
  styles: `
    :host { display: block; }

    .map { position: relative; }

    svg { display: block; width: 100%; height: auto; }

    .map__graticule { fill: none; stroke: rgba(148, 163, 184, 0.08); stroke-width: 1; }
    .map__land { fill: rgba(148, 163, 184, 0.12); stroke: rgba(148, 163, 184, 0.28); stroke-width: 0.6; }

    .map__route {
      fill: none;
      stroke-width: 1.6;
      stroke-linecap: round;
      opacity: 0.55;
      transition: opacity 0.15s, stroke-width 0.15s;
    }
    .map__route--good { stroke: #34d399; }
    .map__route--fair { stroke: #fbbf24; }
    .map__route--poor { stroke: #f87171; }
    .map__route--thin { opacity: 0.22; stroke-dasharray: 3 4; }
    .map__route--active { opacity: 1; stroke-width: 2.6; }

    .map__origin-ring { fill: none; stroke: rgba(245, 184, 61, 0.45); stroke-width: 2; }
    .map__origin { fill: #f5b83d; stroke: #0b1220; stroke-width: 2; }
    .map__origin-label {
      font: 600 12px var(--mono);
      text-anchor: middle;
      fill: var(--text);
      paint-order: stroke;
      stroke: #0b1220;
      stroke-width: 4px;
    }

    .map__dot {
      stroke: #0b1220;
      stroke-width: 2;
      cursor: pointer;
      outline: none;
      transition: filter 0.15s;

      &:hover, &:focus-visible { filter: brightness(1.2); stroke: var(--text); }
    }
    .map__dot--good { fill: #34d399; }
    .map__dot--fair { fill: #fbbf24; }
    .map__dot--poor { fill: #f87171; }
    .map__dot--thin { fill-opacity: 0.35; }

    .map__label {
      font: 600 11px var(--mono);
      fill: var(--text-muted);
      paint-order: stroke;
      stroke: #0b1220;
      stroke-width: 3px;
      pointer-events: none;
    }

    .map__tip {
      position: absolute;
      z-index: 5;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 170px;
      padding: 8px 10px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      font-size: 0.75rem;
      color: var(--text-muted);
      background: #0a101c;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8);
      pointer-events: none;
      transform: translate(-50%, calc(-100% - 14px));

      b { color: var(--text); font-family: var(--mono); }
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      margin: 12px 0 0;
      padding: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
      list-style: none;

      li { display: inline-flex; align-items: center; gap: 6px; }

      &__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;

        &--good { background: #34d399; }
        &--fair { background: #fbbf24; }
        &--poor { background: #f87171; }
      }

      &__note { margin-left: auto; }
    }
  `,
})
export class RouteMap {
  readonly code = input.required<string>();
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly routes = input<RouteInsight[]>([]);

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly minFlights = MIN_FLIGHTS;
  protected readonly hovered = signal<Destination | null>(null);

  private readonly mapped = computed(() => this.routes().filter((r) => r.latitude != null && r.longitude != null));

  /** Centred on the airport and zoomed to fit its destinations (at least ~1,500 km around it). */
  private readonly projection = computed(() => {
    const lon = this.longitude();
    const lat = this.latitude();
    const points: [number, number][] = [
      [lon, lat],
      [lon + 14, lat],
      [lon - 14, lat],
      [lon, lat + 12],
      [lon, lat - 12],
      ...this.mapped().map((r) => [r.longitude!, r.latitude!] as [number, number]),
    ];
    return geoAzimuthalEquidistant()
      .rotate([-lon, -lat])
      .fitExtent(
        [
          [PADDING, PADDING],
          [WIDTH - PADDING, HEIGHT - PADDING],
        ],
        { type: 'MultiPoint', coordinates: points },
      );
  });

  private readonly path = computed(() => geoPath(this.projection()));
  protected readonly landPath = computed(() => this.path()(LAND) ?? '');
  protected readonly graticulePath = computed(() => this.path()(geoGraticule10()) ?? '');

  protected readonly origin = computed(() => {
    const point = this.projection()([this.longitude(), this.latitude()]);
    return point ? { x: point[0], y: point[1] } : null;
  });

  protected readonly destinations = computed<Destination[]>(() => {
    const projection = this.projection();
    const path = this.path();
    const from: [number, number] = [this.longitude(), this.latitude()];
    const labelled = this.pickLabels(projection);

    return this.mapped()
      .map((route) => {
        const to: [number, number] = [route.longitude!, route.latitude!];
        const point = projection(to);
        if (!point) return null;
        return {
          route,
          x: point[0],
          y: point[1],
          path: path({ type: 'LineString', coordinates: [from, to] }) ?? '',
          radius: 3.5 + Math.sqrt(route.flights) * 1.6,
          tone: this.tone(route.on_time_pct),
          thin: route.flights < MIN_FLIGHTS,
          labelled: labelled.has(route.arrival_iata),
        };
      })
      .filter((d): d is Destination => d !== null)
      // Busiest last, so their dots sit on top.
      .sort((a, b) => a.route.flights - b.route.flights);
  });

  protected readonly summary = computed(
    () => `Map of ${this.mapped().length} destinations flown to from ${this.code()}, coloured by on-time rate.`,
  );

  protected describe(d: Destination): string {
    const r = d.route;
    return `${r.arrival_iata} ${r.arrival_airport ?? ''}: ${r.on_time_pct}% on time, ${r.flights} flights, average delay ${r.avg_delay_min} minutes`;
  }

  /**
   * The busiest destinations get a code label, skipping any whose label would
   * overlap one already placed or the airport's own label (nearby airports
   * crowd around the centre).
   */
  private pickLabels(projection: ReturnType<typeof geoAzimuthalEquidistant>): Set<string> {
    const origin = projection([this.longitude(), this.latitude()]);
    // Boxes as [left, top, right, bottom]; the origin's marker and label above it.
    const taken: number[][] = origin ? [[origin[0] - 22, origin[1] - 32, origin[0] + 22, origin[1] + 12]] : [];
    const chosen = new Set<string>();

    for (const route of [...this.mapped()].sort((a, b) => b.flights - a.flights)) {
      if (chosen.size >= LABELLED) break;
      const point = projection([route.longitude!, route.latitude!]);
      if (!point) continue;
      const radius = 3.5 + Math.sqrt(route.flights) * 1.6;
      const box = [point[0] + radius + 3, point[1] - 9, point[0] + radius + 36, point[1] + 7];
      const overlaps = taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
      if (overlaps) continue;
      taken.push(box);
      chosen.add(route.arrival_iata);
    }
    return chosen;
  }

  private tone(onTimePct: number): Tone {
    if (onTimePct >= 80) return 'good';
    if (onTimePct >= 60) return 'fair';
    return 'poor';
  }
}
