import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { Brand } from '../../shared/brand';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';
import { airportsByActivity } from '../../shared/weather-airports';
import { WeatherCard } from '../../shared/weather-card';

/** Weather for every airport in the current flights, busiest first. */
@Component({
  selector: 'app-weather',
  imports: [RouterLink, Brand, StateNotice, WeatherCard],
  templateUrl: './weather.html',
  styleUrl: './weather.scss',
})
export class Weather {
  private readonly api = inject(FlightPulseApi);

  protected readonly flights = rxResource({ stream: () => this.api.getFlights() });
  protected readonly airports = computed(() => airportsByActivity(this.flights.hasValue() ? this.flights.value() : []));
  protected readonly flightsError = computed(() => describeHttpError(this.flights.error()));

  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.airports();
    return this.airports().filter((a) =>
      [a.icao, a.iata, a.name].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  });

  constructor() {
    reloadOnRefresh(this.flights);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
