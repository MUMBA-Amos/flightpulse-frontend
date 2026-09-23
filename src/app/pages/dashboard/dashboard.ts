import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { FlightPulseStats } from '../../models/stats.model';
import { AircraftPanel } from '../../panels/aircraft-panel/aircraft-panel';
import { AirlinesPanel } from '../../panels/airlines-panel/airlines-panel';
import { AirportsPanel } from '../../panels/airports-panel/airports-panel';
import { FlightsPanel } from '../../panels/flights-panel/flights-panel';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { RefreshService, reloadOnRefresh } from '../../services/refresh.service';
import { Brand } from '../../shared/brand';

type TabId = 'flights' | 'airlines' | 'airports' | 'aircraft';

interface Tab {
  id: TabId;
  label: string;
  statKey: keyof FlightPulseStats;
  /** What the count covers, shown under the number. */
  hint: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, Brand, FlightsPanel, AirlinesPanel, AirportsPanel, AircraftPanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly api = inject(FlightPulseApi);
  private readonly refresher = inject(RefreshService);

  protected readonly tabs: Tab[] = [
    { id: 'flights', label: 'Flights', statKey: 'total_flights', hint: 'Daily sample' },
    { id: 'airlines', label: 'Airlines', statKey: 'total_airlines', hint: 'In the daily sample' },
    { id: 'airports', label: 'Airports', statKey: 'total_airports', hint: 'In the daily sample' },
    { id: 'aircraft', label: 'Aircraft tracked', statKey: 'total_aircraft', hint: 'Worldwide · every 30 min' },
  ];

  protected readonly stats = rxResource({ stream: () => this.api.getStats() });
  /** Optional `?tab=` query param, e.g. /dashboard?tab=aircraft */
  readonly tab = input<string>();

  protected readonly activeTab = linkedSignal<TabId>(() =>
    this.tabs.some((t) => t.id === this.tab()) ? (this.tab() as TabId) : 'flights',
  );
  /** Panels stay mounted once opened, so switching tabs doesn't refetch. */
  protected readonly visited = signal(new Set<TabId>());
  protected readonly lastRefresh = signal(new Date());

  protected select(tab: TabId): void {
    // Remember the tab being left too, so its panel stays mounted.
    this.visited.update((v) => new Set(v).add(this.activeTab()).add(tab));
    this.activeTab.set(tab);
  }

  protected statValue(tab: Tab): number | null {
    return this.stats.hasValue() ? this.stats.value()[tab.statKey] : null;
  }

  constructor() {
    // Covers both the Refresh button and the automatic refresh.
    reloadOnRefresh(this.stats);
    effect(() => {
      this.refresher.tick();
      untracked(() => this.lastRefresh.set(new Date()));
    });
  }

  protected refresh(): void {
    this.refresher.refresh();
  }
}
