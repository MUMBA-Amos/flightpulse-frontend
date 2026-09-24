import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { Flight } from '../../models/flight.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { Pager } from '../../shared/pager';
import { paginate } from '../../shared/pagination';
import { StateNotice } from '../../shared/state-notice';
import { WeatherBadge } from '../../shared/weather-badge';

interface DelayInfo {
  label: string;
  tone: 'ok' | 'late' | 'unknown';
}

type StatusFilter = 'all' | 'active' | 'landed';
type DelayFilter = 'all' | 'delayed' | 'on-time';

@Component({
  selector: 'app-flights-panel',
  imports: [DatePipe, Pager, StateNotice, WeatherBadge],
  templateUrl: './flights-panel.html',
  styleUrl: './flights-panel.scss',
})
export class FlightsPanel {
  private readonly api = inject(FlightPulseApi);

  protected readonly flights = rxResource({ stream: () => this.api.getFlights() });
  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly delayFilter = signal<DelayFilter>('all');
  /** Airline name, or '' for all airlines. */
  protected readonly airlineFilter = signal('');

  protected readonly statusOptions: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'In the air' },
    { id: 'landed', label: 'Landed' },
  ];
  protected readonly delayOptions: { id: DelayFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'delayed', label: 'Delayed' },
    { id: 'on-time', label: 'On time' },
  ];

  protected readonly all = computed(() => (this.flights.hasValue() ? this.flights.value() : []));

  /** Airlines in the current flights, A–Z, for the airline filter. */
  protected readonly airlines = computed(() =>
    [...new Set(this.all().map((f) => f.airline_name).filter((n): n is string => !!n))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const delay = this.delayFilter();
    const airline = this.airlineFilter();
    return this.all().filter((f) => {
      if (status !== 'all' && (f.flight_status ?? '').toLowerCase() !== status) return false;
      if (delay === 'delayed' && !this.isDelayed(f)) return false;
      if (delay === 'on-time' && this.isDelayed(f)) return false;
      if (airline && f.airline_name !== airline) return false;
      return !q || this.searchText(f).includes(q);
    });
  });

  /** The rows on the current page. */
  protected readonly pages = paginate(
    () => this.filtered(),
    () => [this.query(), this.statusFilter(), this.delayFilter(), this.airlineFilter()].join('|'),
  );

  protected readonly filtersActive = computed(
    () => !!this.query() || this.statusFilter() !== 'all' || this.delayFilter() !== 'all' || !!this.airlineFilter(),
  );

  protected readonly delayedCount = computed(() => this.all().filter((f) => this.isDelayed(f)).length);
  protected readonly errorMessage = computed(() => describeHttpError(this.flights.error()));


  constructor() {
    reloadOnRefresh(this.flights);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onAirline(event: Event): void {
    this.airlineFilter.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.statusFilter.set('all');
    this.delayFilter.set('all');
    this.airlineFilter.set('');
  }

  protected flightCode(f: Flight): string {
    return f.flight_iata ?? f.flight_icao ?? f.flight_number ?? '-';
  }

  protected routeLabel(f: Flight): string {
    return f.route ?? `${f.departure_iata ?? '???'} → ${f.arrival_iata ?? '???'}`;
  }

  protected statusLabel(f: Flight): string {
    const labels: Record<string, string> = {
      active: 'In the air',
      landed: 'Landed',
      scheduled: 'Scheduled',
      cancelled: 'Cancelled',
      incident: 'Incident',
      diverted: 'Diverted',
    };
    return labels[(f.flight_status ?? '').toLowerCase()] ?? 'Unknown';
  }

  protected statusClass(f: Flight): string {
    return `status status--${(f.flight_status ?? 'unknown').toLowerCase()}`;
  }

  protected departureDelay(f: Flight): DelayInfo {
    return this.delayInfo(f.departure_delay, f.is_departure_delayed);
  }

  protected arrivalDelay(f: Flight): DelayInfo {
    return this.delayInfo(f.arrival_delay, f.is_arrival_delayed);
  }

  private delayInfo(minutes: number | null, delayed: boolean | null): DelayInfo {
    if (minutes != null && minutes > 0) return { label: `+${minutes} min`, tone: 'late' };
    if (delayed) return { label: 'Delayed', tone: 'late' };
    if (minutes === 0 || delayed === false) return { label: 'On time', tone: 'ok' };
    return { label: 'No data', tone: 'unknown' };
  }

  private isDelayed(f: Flight): boolean {
    return (
      !!f.is_departure_delayed ||
      !!f.is_arrival_delayed ||
      (f.departure_delay ?? 0) > 0 ||
      (f.arrival_delay ?? 0) > 0
    );
  }

  private searchText(f: Flight): string {
    return [
      f.flight_iata,
      f.flight_icao,
      f.flight_number,
      f.airline_name,
      f.airline_iata,
      f.airline_icao,
      f.departure_airport,
      f.departure_iata,
      f.departure_icao,
      f.arrival_airport,
      f.arrival_iata,
      f.arrival_icao,
      f.route,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
}
