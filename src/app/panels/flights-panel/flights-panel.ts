import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { Flight } from '../../models/flight.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';
import { WeatherBadge } from '../../shared/weather-badge';

interface DelayInfo {
  label: string;
  tone: 'ok' | 'late' | 'unknown';
}

@Component({
  selector: 'app-flights-panel',
  imports: [DatePipe, StateNotice, WeatherBadge],
  templateUrl: './flights-panel.html',
  styleUrl: './flights-panel.scss',
})
export class FlightsPanel {
  private readonly api = inject(FlightPulseApi);

  protected readonly flights = rxResource({ stream: () => this.api.getFlights() });
  protected readonly query = signal('');

  protected readonly all = computed(() => (this.flights.hasValue() ? this.flights.value() : []));

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.all();
    return this.all().filter((f) => this.searchText(f).includes(q));
  });

  protected readonly delayedCount = computed(() => this.all().filter((f) => this.isDelayed(f)).length);
  protected readonly errorMessage = computed(() => describeHttpError(this.flights.error()));


  constructor() {
    reloadOnRefresh(this.flights);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected flightCode(f: Flight): string {
    return f.flight_iata ?? f.flight_icao ?? f.flight_number ?? '—';
  }

  protected routeLabel(f: Flight): string {
    return f.route ?? `${f.departure_iata ?? '???'} → ${f.arrival_iata ?? '???'}`;
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
