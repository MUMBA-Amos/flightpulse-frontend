import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { Metar } from '../../models/weather.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { WeatherService, WeatherState } from '../../services/weather.service';
import { describeHttpError } from '../../shared/http-error';
import { SiteNav } from '../../shared/site-nav';
import { StateNotice } from '../../shared/state-notice';
import { WeatherAirport, airportsByActivity } from '../../shared/weather-airports';
import { WeatherCard } from '../../shared/weather-card';
import { weatherKind } from '../../shared/weather-format';
import { WeatherIcon } from '../../shared/weather-icon';

const KMH_PER_KNOT = 1.852;

type ConditionFilter = 'all' | 'good' | 'fair' | 'poor' | 'wet';

interface Report {
  airport: WeatherAirport;
  state: WeatherState;
}

/** A reading worth calling out in the summary, e.g. the warmest airport. */
interface Extreme {
  value: number;
  airport: WeatherAirport;
  metar: Metar;
}

/** Weather for every airport in the current flights, busiest first. */
@Component({
  selector: 'app-weather',
  imports: [DecimalPipe, StateNotice, WeatherCard, WeatherIcon, SiteNav],
  templateUrl: './weather.html',
  styleUrl: './weather.scss',
})
export class Weather {
  private readonly api = inject(FlightPulseApi);
  private readonly weather = inject(WeatherService);

  protected readonly flights = rxResource({ stream: () => this.api.getFlights() });
  protected readonly airports = computed(() => airportsByActivity(this.flights.hasValue() ? this.flights.value() : []));
  protected readonly flightsError = computed(() => describeHttpError(this.flights.error()));

  /** Each airport with its latest weather, loaded once per airport by WeatherService. */
  private readonly states = computed(() =>
    this.airports().map((airport) => ({ airport, state: untracked(() => this.weather.forAirport(airport.icao)) })),
  );
  private readonly reports = computed<Report[]>(() => this.states().map(({ airport, state }) => ({ airport, state: state() })));
  private readonly observed = computed(() =>
    this.reports().flatMap((r) => (r.state.status === 'ok' ? [{ airport: r.airport, metar: r.state.metar }] : [])),
  );

  // ---------- Summary ----------

  protected readonly reporting = computed(() => this.observed().length);
  protected readonly conditionCounts = computed(() => {
    const counts = { VFR: 0, MVFR: 0, IFR: 0, LIFR: 0 };
    for (const { metar } of this.observed()) {
      const cat = metar.fltCat?.toUpperCase() as keyof typeof counts | undefined;
      if (cat && cat in counts) counts[cat]++;
    }
    return counts;
  });
  protected readonly conditionSegments = computed(() => {
    const c = this.conditionCounts();
    const total = c.VFR + c.MVFR + c.IFR + c.LIFR || 1;
    return [
      { label: 'Good', count: c.VFR, tone: 'good', share: (c.VFR / total) * 100 },
      { label: 'Fair', count: c.MVFR, tone: 'fair', share: (c.MVFR / total) * 100 },
      { label: 'Poor', count: c.IFR, tone: 'poor', share: (c.IFR / total) * 100 },
      { label: 'Very poor', count: c.LIFR, tone: 'very-poor', share: (c.LIFR / total) * 100 },
    ];
  });
  protected readonly warmest = computed(() => this.extreme((m) => m.temp, 'max'));
  protected readonly coolest = computed(() => this.extreme((m) => m.temp, 'min'));
  protected readonly windiest = computed(() =>
    this.extreme((m) => (m.wspd == null ? null : Math.round(m.wspd * KMH_PER_KNOT)), 'max'),
  );
  protected readonly wetCount = computed(() => this.observed().filter(({ metar }) => this.isWet(metar)).length);

  // ---------- Filters ----------

  protected readonly query = signal('');
  protected readonly conditionFilter = signal<ConditionFilter>('all');
  protected readonly conditionOptions: { id: ConditionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Fair' },
    { id: 'poor', label: 'Poor' },
    { id: 'wet', label: 'Rain or storms' },
  ];

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const condition = this.conditionFilter();
    return this.reports()
      .filter((r) => this.matchesCondition(r.state, condition))
      .map((r) => r.airport)
      .filter((a) => !q || [a.icao, a.iata, a.name].filter(Boolean).join(' ').toLowerCase().includes(q));
  });

  constructor() {
    reloadOnRefresh(this.flights);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.conditionFilter.set('all');
  }

  protected airportLabel(e: Extreme): string {
    return e.airport.name ?? e.airport.iata ?? e.airport.icao;
  }

  private matchesCondition(state: WeatherState, condition: ConditionFilter): boolean {
    if (condition === 'all') return true;
    if (state.status !== 'ok') return false;
    const cat = state.metar.fltCat?.toUpperCase();
    switch (condition) {
      case 'good':
        return cat === 'VFR';
      case 'fair':
        return cat === 'MVFR';
      case 'poor':
        return cat === 'IFR' || cat === 'LIFR';
      case 'wet':
        return this.isWet(state.metar);
    }
  }

  private isWet(m: Metar): boolean {
    const kind = weatherKind(m);
    return kind === 'rain' || kind === 'storm' || kind === 'snow';
  }

  private extreme(read: (m: Metar) => number | null | undefined, pick: 'max' | 'min'): Extreme | null {
    let best: Extreme | null = null;
    for (const { airport, metar } of this.observed()) {
      const value = read(metar);
      if (value == null) continue;
      if (!best || (pick === 'max' ? value > best.value : value < best.value)) best = { value, airport, metar };
    }
    return best;
  }
}
