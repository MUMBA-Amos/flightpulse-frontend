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

  protected readonly all = computed(() => (this.aircraft.hasValue() ? this.aircraft.value() : []));

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mode = this.groundFilter();
    return this.all().filter((a) => {
      if (mode === 'airborne' && a.on_ground) return false;
      if (mode === 'ground' && !a.on_ground) return false;
      if (!q) return true;
      return [a.callsign, a.icao24, a.origin_country, a.squawk]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  });

  protected readonly errorMessage = computed(() => describeHttpError(this.aircraft.error()));


  constructor() {
    reloadOnRefresh(this.aircraft);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected readonly callsign = callsign;
  protected readonly altitudeFt = altitudeFt;
  protected readonly speedKmh = speedKmh;
  protected readonly compassPoint = compassPoint;
  protected readonly climb = climb;
  protected readonly lastSeen = lastSeen;
}
