import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AirportActivity } from '../../models/airport.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { reloadOnRefresh } from '../../services/refresh.service';
import { describeHttpError } from '../../shared/http-error';
import { StateNotice } from '../../shared/state-notice';

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
  private readonly maxActivity = computed(() => Math.max(1, ...this.all().map((a) => a.total_activity)));
  protected readonly errorMessage = computed(() => describeHttpError(this.airports.error()));

  constructor() {
    reloadOnRefresh(this.airports);
  }

  protected departuresWidth(a: AirportActivity): number {
    return (a.scheduled_departures / this.maxActivity()) * 100;
  }

  protected arrivalsWidth(a: AirportActivity): number {
    return (a.scheduled_arrivals / this.maxActivity()) * 100;
  }
}
