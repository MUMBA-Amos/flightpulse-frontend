import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';

import { Metar } from '../models/weather.model';
import { WeatherService, WeatherState } from '../services/weather.service';
import { WeatherIcon } from './weather-icon';
import { describeWx, flyingConditions, weatherKind, wind } from './weather-format';

/** Compact live-weather line for an airport, from its latest METAR. */
@Component({
  selector: 'app-weather-badge',
  template: `
    @switch (state().status) {
      @case ('loading') {
        <span class="wx wx--muted">Loading weather…</span>
      }
      @case ('none') {
        <span class="wx wx--muted">No recent weather</span>
      }
      @case ('error') {
        <span class="wx wx--muted">Weather unavailable</span>
      }
      @case ('ok') {
        @if (metar(); as m) {
          <span class="wx" [attr.title]="tooltip()" [attr.aria-label]="summary()">
            <app-weather-icon class="wx__icon" [kind]="kind()" />
            @if (m.temp != null) {
              <span class="wx__temp">{{ m.temp | number: '1.0-0' }}°C</span>
            }
            @if (m.fltCat && rating()) {
              <span class="wx__cat wx__cat--{{ m.fltCat.toLowerCase() }}" title="Flying conditions">{{ rating() }}</span>
            }
            @if (windText(); as w) {
              <span class="wx__sep">{{ w }}</span>
            }
            @if (conditions(); as c) {
              <span class="wx__sep wx__cond">{{ c }}</span>
            }
          </span>
        }
      }
    }
  `,
  imports: [DecimalPipe, WeatherIcon],
  styles: `
    :host { display: block; min-width: 0; }
    .wx {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px 8px;
      margin-top: 4px;
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--text-muted);
      cursor: default;
    }
    .wx__icon { font-size: 1.1rem; color: var(--text); }
    .wx__temp { font-weight: 600; color: var(--text); }
    .wx--muted { font-family: var(--sans); opacity: 0.8; }
    .wx__sep::before { content: '·'; margin-right: 8px; opacity: 0.6; }
    .wx__cond { font-family: var(--sans); color: var(--text); }
    .wx__cat {
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      background: rgba(148, 163, 184, 0.12);
    }
    .wx__cat--vfr { color: #34d399; background: rgba(52, 211, 153, 0.12); }
    .wx__cat--mvfr { color: #60a5fa; background: rgba(96, 165, 250, 0.14); }
    .wx__cat--ifr { color: #f87171; background: rgba(248, 113, 113, 0.14); }
    .wx__cat--lifr { color: #e879f9; background: rgba(232, 121, 249, 0.14); }
  `,
})
export class WeatherBadge {
  private readonly weather = inject(WeatherService);

  readonly icao = input<string | null>(null);

  private readonly source = computed(() => {
    const icao = this.icao();
    return icao ? this.weather.forAirport(icao) : null;
  });

  protected readonly state = computed<WeatherState>(() => this.source()?.() ?? { status: 'none' });
  protected readonly metar = computed(() => {
    const s = this.state();
    return s.status === 'ok' ? s.metar : null;
  });

  protected readonly windText = computed(() => {
    const m = this.metar();
    return m ? wind(m) : null;
  });

  protected readonly kind = computed(() => {
    const m = this.metar();
    return m ? weatherKind(m) : 'clear';
  });

  protected readonly conditions = computed(() => describeWx(this.metar()?.wxString));
  protected readonly rating = computed(() => flyingConditions(this.metar()?.fltCat));

  protected readonly tooltip = computed(() => {
    const m = this.metar();
    if (!m) return null;
    const observed = m.obsTime ? `Observed ${new Date(m.obsTime * 1000).toLocaleString()}\n` : '';
    return `${m.name ?? m.icaoId}\n${observed}`.trim();
  });

  protected readonly summary = computed(() => {
    const m = this.metar();
    if (!m) return null;
    return [
      `Weather at ${m.name ?? m.icaoId}`,
      this.rating() ? `flying conditions ${this.rating()!.toLowerCase()}` : null,
      m.temp != null ? `${Math.round(m.temp)} degrees Celsius` : null,
      this.windText() ? `wind ${this.windText()}` : null,
      this.conditions(),
    ]
      .filter(Boolean)
      .join(', ');
  });
}
