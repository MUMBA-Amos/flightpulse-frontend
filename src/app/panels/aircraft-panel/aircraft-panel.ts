import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AircraftState } from '../../models/aircraft.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { altitudeFt, callsign, climb, lastSeen, speedKmh } from '../../shared/aircraft-format';
import { compassPoint } from '../../shared/compass';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';

type GroundFilter = 'all' | 'airborne' | 'ground';
type AircraftSort = 'recent' | 'altitude' | 'speed' | 'flight';

@Component({
  selector: 'app-aircraft-panel',
  imports: [DatePipe, DecimalPipe, StateNotice],
  templateUrl: './aircraft-panel.html',
  styleUrl: './aircraft-panel.scss',
})
export class AircraftPanel {
  private readonly api = inject(FlightPulseApi);

  /** Total aircraft in the table (from /stats/), for the "showing X of Y" note. */
  readonly total = input<number | null>(null);

  protected readonly aircraft = rxResource({ stream: () => this.api.getAircraft() });
  protected readonly query = signal('');
  protected readonly groundFilter = signal<GroundFilter>('all');
  protected readonly filters: { id: GroundFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'airborne', label: 'In the air' },
    { id: 'ground', label: 'On the ground' },
  ];

  /** Country name, or '' for all countries. */
  protected readonly countryFilter = signal('');
  protected readonly sortBy = signal<AircraftSort>('recent');
  protected readonly sortOptions: { id: AircraftSort; label: string }[] = [
    { id: 'recent', label: 'Most recently seen' },
    { id: 'altitude', label: 'Highest' },
    { id: 'speed', label: 'Fastest' },
    { id: 'flight', label: 'Flight number (A–Z)' },
  ];

  protected readonly all = computed(() => (this.aircraft.hasValue() ? this.aircraft.value() : []));

  /** Countries in the current list, A–Z, for the country filter. */
  protected readonly countries = computed(() =>
    [...new Set(this.all().map((a) => a.origin_country).filter((c): c is string => !!c))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mode = this.groundFilter();
    const country = this.countryFilter();
    const rows = this.all().filter((a) => {
      if (mode === 'airborne' && a.on_ground) return false;
      if (mode === 'ground' && !a.on_ground) return false;
      if (country && a.origin_country !== country) return false;
      if (!q) return true;
      return [a.callsign, a.icao24, a.origin_country, a.squawk]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    return rows.sort(this.comparator(this.sortBy()));
  });

  protected readonly filtersActive = computed(
    () => !!this.query() || this.groundFilter() !== 'all' || !!this.countryFilter(),
  );

  protected readonly errorMessage = computed(() => describeHttpError(this.aircraft.error()));


  constructor() {
    reloadOnRefresh(this.aircraft);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onCountry(event: Event): void {
    this.countryFilter.set((event.target as HTMLSelectElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as AircraftSort);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.groundFilter.set('all');
    this.countryFilter.set('');
  }

  private comparator(sort: AircraftSort): (a: AircraftState, b: AircraftState) => number {
    switch (sort) {
      case 'altitude':
        return (a, b) => (altitudeFt(b) ?? -1) - (altitudeFt(a) ?? -1);
      case 'speed':
        return (a, b) => (speedKmh(b) ?? -1) - (speedKmh(a) ?? -1);
      case 'flight':
        return (a, b) => callsign(a).localeCompare(callsign(b));
      default:
        return (a, b) => (b.time_position ?? 0) - (a.time_position ?? 0);
    }
  }

  protected readonly callsign = callsign;
  protected readonly altitudeFt = altitudeFt;
  protected readonly speedKmh = speedKmh;
  protected readonly compassPoint = compassPoint;
  protected readonly climb = climb;
  protected readonly lastSeen = lastSeen;
}
