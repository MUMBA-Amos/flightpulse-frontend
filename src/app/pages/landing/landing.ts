import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Flight } from '../../models/flight.model';
import { FlightPulseStats } from '../../models/stats.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { altitudeFt, callsign, climb, lastSeen, speedKt } from '../../shared/aircraft-format';
import { Brand } from '../../shared/brand';
import { describeHttpError } from '../../shared/http-error';
import { WeatherBadge } from '../../shared/weather-badge';
import { airportsByActivity } from '../../shared/weather-airports';
import { WeatherCard } from '../../shared/weather-card';
import { Globe } from './globe/globe';

/** How many airports the weather section shows; the rest are on /weather. */
const WEATHER_AIRPORTS = 8;

@Component({
  selector: 'app-landing',
  imports: [DatePipe, DecimalPipe, RouterLink, Brand, Globe, WeatherBadge, WeatherCard],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private readonly api = inject(FlightPulseApi);

  protected readonly stats = rxResource({ stream: () => this.api.getStats() });
  protected readonly aircraft = rxResource({ stream: () => this.api.getAircraft() });
  protected readonly delayed = rxResource({ stream: () => this.api.getDelayedFlights() });
  protected readonly flights = rxResource({ stream: () => this.api.getFlights() });

  /** Every airport in the current flights, busiest first; the landing page shows the top few. */
  protected readonly allWeatherAirports = computed(() =>
    airportsByActivity(this.flights.hasValue() ? this.flights.value() : []),
  );
  protected readonly weatherAirports = computed(() => this.allWeatherAirports().slice(0, WEATHER_AIRPORTS));
  protected readonly flightsError = computed(() => describeHttpError(this.flights.error()));

  protected readonly delayedList = computed(() => (this.delayed.hasValue() ? this.delayed.value() : []));
  /** The Delay watch section shows the worst few; the dashboard has the rest. */
  protected readonly topDelays = computed(() => this.delayedList().slice(0, 6));
  protected readonly delayedError = computed(() => describeHttpError(this.delayed.error()));

  protected readonly aircraftList = computed(() => (this.aircraft.hasValue() ? this.aircraft.value() : []));
  /** Aircraft that can be shown on the globe. */
  protected readonly airborne = computed(() =>
    this.aircraftList().filter((a) => !a.on_ground && a.latitude != null && a.longitude != null),
  );

  protected readonly query = signal('');
  protected readonly trackList = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.airborne();
    return this.airborne().filter((a) =>
      [a.callsign, a.icao24, a.origin_country, a.squawk].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  });

  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.airborne().find((a) => a.icao24 === this.selectedId()) ?? null);
  protected readonly aircraftError = computed(() => describeHttpError(this.aircraft.error()));

  protected readonly figures: { label: string; key: keyof FlightPulseStats }[] = [
    { label: 'Flights', key: 'total_flights' },
    { label: 'Airlines', key: 'total_airlines' },
    { label: 'Airports', key: 'total_airports' },
    { label: 'Aircraft tracked', key: 'total_aircraft' },
  ];

  protected readonly callsign = callsign;
  protected readonly altitudeFt = altitudeFt;
  protected readonly speedKt = speedKt;
  protected readonly climb = climb;
  protected readonly lastSeen = lastSeen;

  constructor() {
    reloadOnRefresh(this.stats, this.aircraft, this.delayed, this.flights);

    // Keep the selected aircraft visible in the list when it is picked on the globe.
    effect(() => {
      const id = this.selectedId();
      const item = id ? document.getElementById(`track-${id}`) : null;
      const list = item?.closest('ul');
      if (!item || !list) return;
      // Scroll only the list — scrollIntoView would also move the page.
      const top = item.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: top - list.clientHeight / 2 + item.offsetHeight / 2, behavior: 'smooth' });
      }
    });
  }

  protected statValue(key: keyof FlightPulseStats): number | null {
    return this.stats.hasValue() ? this.stats.value()[key] : null;
  }

  protected flightCode(f: Flight): string {
    return f.flight_iata ?? f.flight_icao ?? f.flight_number ?? '—';
  }

  /** Largest reported delay for a flight, in minutes. */
  protected worstDelay(f: Flight): number {
    return Math.max(f.departure_delay ?? 0, f.arrival_delay ?? 0);
  }

  protected toggle(id: string): void {
    this.selectedId.update((current) => (current === id ? null : id));
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected scrollTo(id: 'weather' | 'tracking'): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
