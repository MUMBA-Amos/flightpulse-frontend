import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AirlinePerformance } from '../../models/airline.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';

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
  private readonly maxFlights = computed(() => Math.max(1, ...this.all().map((a) => a.total_flights)));
  protected readonly errorMessage = computed(() => describeHttpError(this.airlines.error()));

  constructor() {
    reloadOnRefresh(this.airlines);
  }

  protected share(a: AirlinePerformance): number {
    return (a.total_flights / this.maxFlights()) * 100;
  }

  protected codes(a: AirlinePerformance): string {
    return [a.airline_iata, a.airline_icao].filter(Boolean).join(' · ');
  }

  protected minutes(value: number | null): string {
    if (value == null) return '—';
    return `${Number.isInteger(value) ? value : value.toFixed(1)} min`;
  }
}
