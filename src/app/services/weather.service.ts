import { Injectable, Signal, WritableSignal, effect, inject, signal, untracked } from '@angular/core';

import { Metar } from '../models/weather.model';
import { FlightPulseApi } from './flightpulse-api.service';
import { RefreshService } from './refresh.service';

export type WeatherState =
  | { status: 'loading' }
  | { status: 'ok'; metar: Metar }
  | { status: 'none' }
  | { status: 'error' };

/**
 * Per-airport METAR cache, so an airport shared by several flights is fetched once.
 * Refetches every cached airport when the dashboard's Refresh is pressed.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly api = inject(FlightPulseApi);
  private readonly cache = new Map<string, WritableSignal<WeatherState>>();

  constructor() {
    const tick = inject(RefreshService).tick;
    const initial = untracked(tick);
    effect(() => {
      if (tick() === initial) return;
      untracked(() => this.cache.forEach((state, icao) => this.fetch(icao, state)));
    });
  }

  forAirport(icao: string): Signal<WeatherState> {
    const key = icao.trim().toUpperCase();
    let state = this.cache.get(key);
    if (!state) {
      state = signal<WeatherState>({ status: 'loading' });
      this.cache.set(key, state);
      this.fetch(key, state);
    }
    return state.asReadonly();
  }

  private fetch(icao: string, state: WritableSignal<WeatherState>): void {
    this.api.getWeather(icao).subscribe({
      next: (res) => state.set(res.weather?.length ? { status: 'ok', metar: res.weather[0] } : { status: 'none' }),
      // Keep showing the previous observation if a refresh fails.
      error: () => state.update((s) => (s.status === 'ok' ? s : { status: 'error' })),
    });
  }
}
