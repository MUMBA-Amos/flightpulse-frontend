import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';

import { WeatherService, WeatherState } from '../services/weather.service';
import { describeWx, flyingConditions, visibility, weatherKind, wind } from './weather-format';
import { WeatherIcon } from './weather-icon';

/** Larger weather card for one airport (landing page). */
@Component({
  selector: 'app-weather-card',
  imports: [DecimalPipe, WeatherIcon],
  template: `
    <article class="card" [class.card--muted]="state().status !== 'ok'">
      <header class="card__head">
        <div class="card__airport">
          <span class="card__code">{{ iata() ?? icao() }}</span>
          <span class="card__name">{{ name() ?? icao() }}</span>
        </div>
        @if (metar()?.fltCat; as cat) {
          @if (rating(); as r) {
            <span class="cat cat--{{ cat.toLowerCase() }}" title="Flying conditions">{{ r }}</span>
          }
        }
      </header>

      @switch (state().status) {
        @case ('loading') {
          <p class="card__note">Loading weather…</p>
        }
        @case ('none') {
          <p class="card__note">No recent weather report</p>
        }
        @case ('error') {
          <p class="card__note">Weather unavailable</p>
        }
        @case ('ok') {
          @if (metar(); as m) {
            <div class="card__now">
              <app-weather-icon class="card__icon" [kind]="kind()" />
              <span class="card__temp">
                @if (m.temp != null) { {{ m.temp | number: '1.0-0' }}° } @else { - }
              </span>
              <span class="card__cond">{{ conditions() }}</span>
            </div>
            <dl class="card__facts">
              <div><dt>Wind</dt><dd>{{ windText() ?? '-' }}</dd></div>
              <div><dt>Visibility</dt><dd>{{ visibilityText() ?? '-' }}</dd></div>
              <div><dt>Observed</dt><dd>{{ observed() }}</dd></div>
            </dl>
          }
        }
      }
    </article>
  `,
  styles: `
    :host { display: block; }
    .card {
      height: 100%;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .card--muted { background: var(--surface); }
    .card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .card__airport { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .card__code {
      font-family: var(--mono);
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--accent);
    }
    .card__name {
      overflow: hidden;
      font-size: 0.8rem;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-muted);
    }
    .card__note { margin: 18px 0 4px; font-size: 0.85rem; color: var(--text-muted); }
    .card__now { display: flex; align-items: center; gap: 12px; margin: 16px 0 14px; }
    .card__icon { font-size: 2.4rem; color: var(--text); }
    .card__temp { font-family: var(--mono); font-size: 2rem; font-weight: 600; line-height: 1; }
    .card__cond { font-size: 0.85rem; color: var(--text-muted); }
    .card__facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 0;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .card__facts div { margin: 0; min-width: 0; }
    .card__facts dt {
      margin-bottom: 3px;
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .card__facts dd { margin: 0; font-family: var(--mono); font-size: 0.8rem; }
    .cat {
      padding: 2px 8px;
      border-radius: 3px;
      font-family: var(--mono);
      font-size: 0.7rem;
      font-weight: 700;
      white-space: nowrap;
      color: var(--text-muted);
      background: rgba(200, 194, 180, 0.12);
    }
    .cat--vfr { color: #3ddc84; background: rgba(61, 220, 132, 0.12); }
    .cat--mvfr { color: #60a5fa; background: rgba(96, 165, 250, 0.14); }
    .cat--ifr { color: #ff5c4d; background: rgba(255, 92, 77, 0.14); }
    .cat--lifr { color: #e879f9; background: rgba(232, 121, 249, 0.14); }
  `,
})
export class WeatherCard {
  private readonly weather = inject(WeatherService);

  readonly icao = input.required<string>();
  readonly iata = input<string | null>(null);
  readonly name = input<string | null>(null);

  protected readonly state = computed<WeatherState>(() => this.weather.forAirport(this.icao())());
  protected readonly metar = computed(() => {
    const s = this.state();
    return s.status === 'ok' ? s.metar : null;
  });

  protected readonly kind = computed(() => {
    const m = this.metar();
    return m ? weatherKind(m) : 'clear';
  });
  protected readonly conditions = computed(() => {
    const m = this.metar();
    if (!m) return '';
    return describeWx(m.wxString) ?? ({ clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy' } as Record<string, string>)[this.kind()] ?? '';
  });
  protected readonly rating = computed(() => flyingConditions(this.metar()?.fltCat));
  protected readonly windText = computed(() => {
    const m = this.metar();
    return m ? wind(m) : null;
  });
  protected readonly visibilityText = computed(() => {
    const m = this.metar();
    return m ? visibility(m) : null;
  });
  protected readonly observed = computed(() => {
    const t = this.metar()?.obsTime;
    return t ? new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
  });
}
