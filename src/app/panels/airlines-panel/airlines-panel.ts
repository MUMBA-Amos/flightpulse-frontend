import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AirlinePerformance } from '../../models/airline.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';

type LateFilter = 'all' | 'late' | 'none-late';
type AirlineSort = 'flights' | 'late' | 'delay' | 'name';

@Component({
  selector: 'app-airlines-panel',
  imports: [StateNotice],
  templateUrl: './airlines-panel.html',
  host: { style: 'display: block' },
})
export class AirlinesPanel {
  private readonly api = inject(FlightPulseApi);

  protected readonly airlines = rxResource({ stream: () => this.api.getAirlines() });

  protected readonly all = computed(() => (this.airlines.hasValue() ? this.airlines.value() : []));

  protected readonly query = signal('');
  protected readonly lateFilter = signal<LateFilter>('all');
  protected readonly sortBy = signal<AirlineSort>('flights');

  protected readonly lateOptions: { id: LateFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'late', label: 'Had late flights' },
    { id: 'none-late', label: 'No late flights' },
  ];
  protected readonly sortOptions: { id: AirlineSort; label: string }[] = [
    { id: 'flights', label: 'Most flights' },
    { id: 'late', label: 'Most late flights' },
    { id: 'delay', label: 'Longest average delay' },
    { id: 'name', label: 'Name (A–Z)' },
  ];

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const late = this.lateFilter();
    const rows = this.all().filter((a) => {
      if (late === 'late' && this.lateFlights(a) === 0) return false;
      if (late === 'none-late' && this.lateFlights(a) > 0) return false;
      return !q || [a.airline_name, a.airline_iata, a.airline_icao].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
    return rows.sort(this.comparator(this.sortBy()));
  });

  protected readonly filtersActive = computed(() => !!this.query() || this.lateFilter() !== 'all');
  private readonly maxFlights = computed(() => Math.max(1, ...this.all().map((a) => a.total_flights)));
  protected readonly errorMessage = computed(() => describeHttpError(this.airlines.error()));

  constructor() {
    reloadOnRefresh(this.airlines);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as AirlineSort);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.lateFilter.set('all');
  }

  protected share(a: AirlinePerformance): number {
    return (a.total_flights / this.maxFlights()) * 100;
  }

  protected codes(a: AirlinePerformance): string {
    return [a.airline_iata, a.airline_icao].filter(Boolean).join(' · ');
  }

  private lateFlights(a: AirlinePerformance): number {
    return (a.delayed_departures ?? 0) + (a.delayed_arrivals ?? 0);
  }

  private comparator(sort: AirlineSort): (a: AirlinePerformance, b: AirlinePerformance) => number {
    const name = (a: AirlinePerformance, b: AirlinePerformance) => (a.airline_name ?? '').localeCompare(b.airline_name ?? '');
    switch (sort) {
      case 'late':
        return (a, b) => this.lateFlights(b) - this.lateFlights(a) || b.total_flights - a.total_flights || name(a, b);
      case 'delay':
        return (a, b) => (b.average_departure_delay ?? -1) - (a.average_departure_delay ?? -1) || name(a, b);
      case 'name':
        return name;
      default:
        return (a, b) => b.total_flights - a.total_flights || name(a, b);
    }
  }

  protected minutes(value: number | null): string {
    if (value == null) return '—';
    return `${Number.isInteger(value) ? value : value.toFixed(1)} min`;
  }
}
