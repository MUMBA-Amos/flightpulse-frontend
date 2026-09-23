import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { FlightPulseStats } from '../../models/stats.model';
import { AircraftPanel } from '../../panels/aircraft-panel/aircraft-panel';
import { AirlinesPanel } from '../../panels/airlines-panel/airlines-panel';
import { AirportsPanel } from '../../panels/airports-panel/airports-panel';
import { FlightsPanel } from '../../panels/flights-panel/flights-panel';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { RefreshService, reloadOnRefresh } from '../../services/refresh.service';
import { SiteNav } from '../../shared/site-nav';
import { Globe } from '../landing/globe/globe';

type TabId = 'flights' | 'airlines' | 'airports' | 'aircraft';

interface Tab {
  id: TabId;
  label: string;
  statKey: keyof FlightPulseStats;
  /** What the count covers, shown under the number. */
  hint: string;
  /** SVG path for the tile's icon (24×24). */
  icon: string;
  /** Filled shape rather than an outline. */
  filled?: boolean;
}

const PLANE_ICON =
  'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, Globe, FlightsPanel, AirlinesPanel, AirportsPanel, AircraftPanel, SiteNav],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: { class: 'page' },
})
export class Dashboard {
  private readonly api = inject(FlightPulseApi);
  private readonly refresher = inject(RefreshService);

  protected readonly tabs: Tab[] = [
    { id: 'flights', label: 'Flights', statKey: 'total_flights', hint: "Today's snapshot", icon: PLANE_ICON, filled: true },
    { id: 'airlines', label: 'Airlines', statKey: 'total_airlines', hint: "Today's snapshot", icon: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01' },
    { id: 'airports', label: 'Airports', statKey: 'total_airports', hint: "Today's snapshot", icon: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    { id: 'aircraft', label: 'Aircraft tracked', statKey: 'total_aircraft', hint: 'Worldwide, updated every 30 min', icon: 'M12 12l6.5-6.5M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5' },
  ];

  protected readonly stats = rxResource({ stream: () => this.api.getStats() });
  /** Planes in the air, for the decorative globe in the header. */
  private readonly airborne = rxResource({ stream: () => this.api.getAircraft(true) });
  protected readonly globeAircraft = computed(() => (this.airborne.hasValue() ? this.airborne.value() : []));
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
