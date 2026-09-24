import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AirlineInsight, HourInsight, RouteInsight } from '../../models/insights.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { describeHttpError } from '../../shared/http-error';
import { SiteNav } from '../../shared/site-nav';
import { StateNotice } from '../../shared/state-notice';

/** Groups with fewer flights than this aren't ranked, and are faded in charts. */
const MIN_FLIGHTS = 5;
/** Days of history before the figures are presented as settled. */
const SETTLED_DAYS = 7;

const TRACKED = [
  { code: 'KUL', label: 'Kuala Lumpur' },
  { code: 'PEN', label: 'Penang' },
];

const BAND_ORDER = ['On time', '16-30 min', '31-60 min', 'Over 60 min'];
const BAND_LABELS: Record<string, string> = {
  'On time': 'On time (within 15 min)',
  '16-30 min': '16–30 min late',
  '31-60 min': '31–60 min late',
  'Over 60 min': 'Over an hour late',
};

interface HourColumn {
  hour: number;
  label: string;
  data: HourInsight | null;
}

/** Delay insights for the tracked airports, from the gold insight tables. */
@Component({
  selector: 'app-insights',
  imports: [DatePipe, DecimalPipe, SiteNav, StateNotice],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
  host: { class: 'page' },
})
export class Insights {
  private readonly api = inject(FlightPulseApi);

  protected readonly tracked = TRACKED;
  protected readonly minFlights = MIN_FLIGHTS;
  protected readonly settledDays = SETTLED_DAYS;

  /** Optional `?airport=` query param, e.g. /insights?airport=PEN */
  readonly airportParam = input<string>(undefined, { alias: 'airport' });
  protected readonly airport = linkedSignal(() =>
    TRACKED.some((t) => t.code === this.airportParam()?.toUpperCase()) ? this.airportParam()!.toUpperCase() : 'KUL',
  );

  protected readonly insights = rxResource({
    params: () => this.airport(),
    stream: ({ params }) => this.api.getInsights(params),
  });
  protected readonly data = computed(() => (this.insights.hasValue() ? this.insights.value() : null));
  protected readonly summary = computed(() => this.data()?.summary ?? null);
  protected readonly errorMessage = computed(() => describeHttpError(this.insights.error()));
  protected readonly placeName = computed(() => TRACKED.find((t) => t.code === this.airport())?.label ?? this.airport());

  protected readonly settled = computed(() => (this.summary()?.days ?? 0) >= SETTLED_DAYS);

  /** All 24 hours, so gaps in the sample are visible rather than hidden. */
  protected readonly hourColumns = computed<HourColumn[]>(() => {
    const byHour = new Map((this.data()?.hours ?? []).map((h) => [h.local_hour, h]));
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      data: byHour.get(hour) ?? null,
    }));
  });
  protected readonly hoursCovered = computed(() => this.hourColumns().filter((c) => c.data).length);

  protected readonly rankedAirlines = computed(() =>
    (this.data()?.airlines ?? [])
      .filter((a) => a.flights >= MIN_FLIGHTS)
      .sort((a, b) => b.on_time_pct - a.on_time_pct || b.flights - a.flights),
  );
  protected readonly unrankedAirlines = computed(
    () => (this.data()?.airlines ?? []).filter((a) => a.flights < MIN_FLIGHTS).length,
  );

  protected readonly bands = computed(() => {
    const rows = new Map((this.data()?.delay_bands ?? []).map((b) => [b.delay_band, b]));
    return BAND_ORDER.map((band) => ({
      band,
      label: BAND_LABELS[band],
      flights: rows.get(band as never)?.flights ?? 0,
      share: rows.get(band as never)?.share_pct ?? 0,
    }));
  });

  protected readonly daily = computed(() => this.data()?.daily ?? []);

  /** Destinations with 3+ flights, least punctual first. */
  protected readonly worstRoutes = computed<RouteInsight[]>(() =>
    (this.data()?.routes ?? [])
      .filter((r) => r.flights >= 3)
      .sort((a, b) => a.on_time_pct - b.on_time_pct || b.flights - a.flights)
      .slice(0, 8),
  );

  protected hourRange(hour: number): string {
    const pad = (h: number) => String(h % 24).padStart(2, '0');
    return `${pad(hour)}:00–${pad(hour + 1)}:00`;
  }

  protected isThin(row: { flights: number } | null): boolean {
    return !row || row.flights < MIN_FLIGHTS;
  }

  protected airlineLabel(a: AirlineInsight): string {
    return `${a.airline_name}: ${a.on_time_pct}% on time across ${a.flights} flights, average delay ${a.avg_delay_min} minutes`;
  }
}
