import { Injectable, Signal, WritableSignal, effect, inject, signal, untracked } from '@angular/core';

import { Metar } from '../models/weather.model';
import { FlightPulseApi } from './flightpulse-api.service';
import { RefreshService } from './refresh.service';

export type WeatherState =
  | { status: 'loading' }
  | { status: 'ok'; metar: Metar }
  | { status: 'none' }
  | { status: 'error' };

/** Airports per batch request; keeps the URL a sensible length. */
const BATCH_SIZE = 50;

/**
 * Per-airport METAR cache, so an airport shared by several flights is fetched once.
 * Airports requested together (e.g. a page of weather cards) are fetched in one
 * batch request rather than one each. Refetches every cached airport when the
 * dashboard's Refresh is pressed.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly api = inject(FlightPulseApi);
  private readonly cache = new Map<string, WritableSignal<WeatherState>>();
  private readonly queued = new Set<string>();

  constructor() {
    const tick = inject(RefreshService).tick;
    const initial = untracked(tick);
    effect(() => {
      if (tick() === initial) return;
      untracked(() => this.cache.forEach((_, icao) => this.fetch(icao)));
    });
  }

  forAirport(icao: string): Signal<WeatherState> {
    const key = icao.trim().toUpperCase();
    let state = this.cache.get(key);
    if (!state) {
      state = signal<WeatherState>({ status: 'loading' });
      this.cache.set(key, state);
      this.fetch(key);
    }
    return state.asReadonly();
  }

  /** Queues the airport; everything queued in the same tick goes out together. */
  private fetch(icao: string): void {
    if (this.queued.size === 0) queueMicrotask(() => this.flush());
    this.queued.add(icao);
  }

  private flush(): void {
    const icaos = [...this.queued];
    this.queued.clear();
    for (let i = 0; i < icaos.length; i += BATCH_SIZE) {
      const batch = icaos.slice(i, i + BATCH_SIZE);
      this.api.getWeatherBatch(batch).subscribe({
        next: (res) => {
          for (const icao of batch) {
            const metar = res.weather[icao];
            this.cache.get(icao)?.set(metar ? { status: 'ok', metar } : { status: 'none' });
          }
        },
        // Keep showing the previous observation if a refresh fails.
        error: () => {
          for (const icao of batch) {
            this.cache.get(icao)?.update((s) => (s.status === 'ok' ? s : { status: 'error' }));
          }
        },
      });
    }
  }
}
