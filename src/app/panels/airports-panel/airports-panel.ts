import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AirportActivity } from '../../models/airport.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';

type AirportSort = 'busiest' | 'departures' | 'arrivals' | 'name';

@Component({
  selector: 'app-airports-panel',
  imports: [StateNotice],
  templateUrl: './airports-panel.html',
  host: { style: 'display: block' },
})
export class AirportsPanel {
  private readonly api = inject(FlightPulseApi);

  protected readonly airports = rxResource({ stream: () => this.api.getAirports() });

  protected readonly all = computed(() => (this.airports.hasValue() ? this.airports.value() : []));

  protected readonly query = signal('');
  protected readonly sortBy = signal<AirportSort>('busiest');
  protected readonly sortOptions: { id: AirportSort; label: string }[] = [
    { id: 'busiest', label: 'Busiest' },
    { id: 'departures', label: 'Most departures' },
    { id: 'arrivals', label: 'Most arrivals' },
    { id: 'name', label: 'Name (A–Z)' },
  ];

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.all().filter(
      (a) => !q || [a.airport_name, a.airport_iata].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
    return rows.sort(this.comparator(this.sortBy()));
  });
  private readonly maxActivity = computed(() => Math.max(1, ...this.all().map((a) => a.total_activity)));
  protected readonly errorMessage = computed(() => describeHttpError(this.airports.error()));

  constructor() {
    reloadOnRefresh(this.airports);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as AirportSort);
  }

  private comparator(sort: AirportSort): (a: AirportActivity, b: AirportActivity) => number {
    const name = (a: AirportActivity, b: AirportActivity) => (a.airport_name ?? '').localeCompare(b.airport_name ?? '');
    switch (sort) {
      case 'departures':
        return (a, b) => b.scheduled_departures - a.scheduled_departures || name(a, b);
      case 'arrivals':
        return (a, b) => b.scheduled_arrivals - a.scheduled_arrivals || name(a, b);
      case 'name':
        return name;
      default:
        return (a, b) => b.total_activity - a.total_activity || name(a, b);
    }
  }

  protected departuresWidth(a: AirportActivity): number {
    return (a.scheduled_departures / this.maxActivity()) * 100;
  }

  protected arrivalsWidth(a: AirportActivity): number {
    return (a.scheduled_arrivals / this.maxActivity()) * 100;
  }
}
