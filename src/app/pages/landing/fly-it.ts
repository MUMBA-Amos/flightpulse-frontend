import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { SimAirport } from '../../models/sim.model';
import { FlightPulseApi } from '../../services/flightpulse-api.service';
import { describeHttpError } from '../../shared/http-error';
import { flyingConditions } from '../../shared/weather-format';

/** "Fly it" card: everything a flight simmer needs to recreate the tracked flight. */
@Component({
  selector: 'app-fly-it',
  imports: [DecimalPipe],
  template: `
    <div class="fly__head">
      <div>
        <p class="kicker">For flight simmers</p>
        <h3>Fly {{ callsign() }} in your sim</h3>
        @if (briefing.hasValue()) {
          <p class="muted">
            @if (briefing.value().aircraft; as ac) {
              {{ ac.manufacturer }} {{ ac.type }}@if (ac.registration) { · {{ ac.registration }} }
            } @else {
              Aircraft type unknown
            }
            @if (briefing.value().airline; as airline) { · {{ airline }} }
            @if (briefing.value().cruise_level; as fl) { · Cruising at {{ fl }} }
          </p>
        }
      </div>
      @if (simbriefUrl(); as url) {
        <a class="btn" [href]="url" target="_blank" rel="noopener">
          Plan in SimBrief
          <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></svg>
        </a>
      }
    </div>

    @if (briefing.isLoading()) {
      <div class="fly__state"><span class="loader" aria-hidden="true"></span><p>Preparing the briefing…</p></div>
    } @else if (briefing.error()) {
      <div class="fly__state" role="alert">
        <p>{{ errorText() }}</p>
        <button type="button" class="btn btn--ghost" (click)="briefing.reload()">Try again</button>
      </div>
    } @else if (briefing.hasValue()) {
      @if (!briefing.value().origin || !briefing.value().destination) {
        <p class="fly__state">
          This flight's route isn't known (common for private and cargo flights), so there's no briefing to build.
        </p>
      } @else {
        @if (simbriefFields().length) {
          <div class="prefill">
            <label class="prefill__type">
              <span class="prefill__label">Aircraft you'll fly</span>
              <input
                type="text"
                list="sim-types"
                maxlength="4"
                placeholder="B738"
                autocomplete="off"
                spellcheck="false"
                [value]="chosenType()"
                (input)="onType($event)"
              />
              <datalist id="sim-types">
                @for (t of commonTypes; track t) { <option [value]="t"></option> }
              </datalist>
              <small>
                @if (realType(); as real) {
                  The real aircraft is {{ real }}. Pick another to fly this flight in a different plane.
                } @else {
                  The real aircraft type isn't known. Pick the one you'll fly, as an ICAO code (e.g. B738).
                }
              </small>
            </label>
            <span class="prefill__label">SimBrief will be filled in with</span>
            <ul>
              @for (f of simbriefFields(); track f.label) {
                <li><span>{{ f.label }}</span> {{ f.value }}</li>
              }
            </ul>
          </div>
        }
        <div class="fly__airports">
          @for (leg of legs(); track leg.label) {
            <section class="leg" [attr.aria-label]="leg.label">
              <p class="leg__label">{{ leg.label }}</p>
              <div class="leg__title">
                <span class="leg__code">{{ leg.airport.icao }}</span>
                <span class="muted">{{ leg.airport.name }}</span>
              </div>

              <dl class="leg__facts">
                <div>
                  <dt>Likely runway</dt>
                  <dd>
                    @if (leg.airport.likely_runway; as rwy) {
                      @if (rwy.ends.length) {
                        <strong>{{ rwy.ends.join(' / ') }}</strong>
                        <small>{{ rwy.headwind_kt }} kt headwind, {{ rwy.crosswind_kt }} kt crosswind</small>
                      } @else {
                        <small>{{ rwy.note }}</small>
                      }
                    } @else {
                      -
                    }
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>
                    @if (leg.airport.wind; as w) {
                      @if (w.variable) { Variable } @else { {{ w.direction | number: '3.0-0' }}° }
                      at {{ w.speed_kt }} kt@if (w.gust_kt) { , gusting {{ w.gust_kt }} }
                    } @else {
                      -
                    }
                  </dd>
                </div>
                <div>
                  <dt>Conditions</dt>
                  <dd>
                    @if (leg.airport.flight_category; as cat) {
                      <span class="cat cat--{{ cat.toLowerCase() }}">{{ cat }}</span>
                      <small>{{ rating(cat) }}</small>
                    } @else {
                      -
                    }
                  </dd>
                </div>
                <div>
                  <dt>Elevation</dt>
                  <dd>
                    @if (leg.airport.elevation_ft != null) { {{ leg.airport.elevation_ft | number }} ft } @else { - }
                  </dd>
                </div>
                <div>
                  <dt>Runways</dt>
                  <dd>{{ leg.airport.runways.length ? leg.airport.runways.join(', ') : '-' }}</dd>
                </div>
                <div>
                  <dt>Frequencies</dt>
                  <dd>
                    @for (f of leg.airport.frequencies; track $index) {
                      <span class="freq">{{ f.name }} {{ f.mhz }}</span>
                    } @empty {
                      -
                    }
                  </dd>
                </div>
              </dl>

              <div class="report">
                <span class="report__label">METAR</span>
                <code>{{ leg.airport.metar ?? 'No recent report' }}</code>
              </div>
              <div class="report">
                <span class="report__label">TAF</span>
                <code>{{ leg.airport.taf ?? 'No forecast issued' }}</code>
              </div>
            </section>
          }
        </div>
        <p class="fly__note">
          The likely runway is a best guess from the wind; real controllers also weigh noise rules and traffic.
          @if (briefing.value().route_source === 'adsbdb') { The route is the usual one for this flight number. }
          SimBrief builds the waypoint route itself and needs a free account.
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 16px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      animation: rise 0.3s ease-out both;
    }
    .fly__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px 24px;
      margin-bottom: 18px;
    }
    .fly__head h3 { margin: 2px 0 4px; font-size: 1.25rem; }
    .fly__head .btn { flex: none; text-decoration: none; }
    .fly__head .muted { margin: 0; font-size: 0.875rem; }
    .fly__state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin: 0;
      padding: 24px 12px;
      text-align: center;
      color: var(--text-muted);
    }
    .fly__state p { margin: 0; }
    .prefill {
      margin-bottom: 16px;
      padding: 12px 14px;
      border: 1px dashed var(--border-strong);
      border-radius: 12px;
    }
    .prefill__label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .prefill__type { display: block; margin-bottom: 12px; }
    .prefill__type input {
      width: 110px;
      padding: 6px 10px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      font-family: var(--mono);
      font-size: 0.9rem;
      text-transform: uppercase;
      color: var(--text);
      background: var(--surface-raised);
    }
    .prefill__type input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .prefill__type small { display: block; margin-top: 6px; font-size: 0.72rem; color: var(--text-muted); }
    .prefill ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .prefill li {
      padding: 3px 9px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 0.78rem;
      background: var(--accent-soft);
    }
    .prefill li span { font-family: var(--sans); font-size: 0.7rem; color: var(--text-muted); }
    .fly__airports {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .leg {
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
    }
    .leg__label {
      margin: 0 0 4px;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .leg__title { display: flex; align-items: baseline; gap: 10px; min-width: 0; margin-bottom: 14px; }
    .leg__title .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; }
    .leg__code { font-family: var(--mono); font-size: 1.2rem; font-weight: 600; letter-spacing: 0.04em; color: var(--accent); }
    .leg__facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 16px;
      margin: 0 0 14px;
    }
    .leg__facts div { min-width: 0; margin: 0; }
    .leg__facts dt {
      margin-bottom: 3px;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .leg__facts dd { margin: 0; font-family: var(--mono); font-size: 0.85rem; overflow-wrap: anywhere; }
    .leg__facts strong { font-size: 1rem; color: var(--sky); }
    .leg__facts small { display: block; margin-top: 2px; font-family: var(--sans); font-size: 0.72rem; color: var(--text-muted); }
    .freq { display: inline-block; margin-right: 10px; white-space: nowrap; }
    .cat { padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
    .cat--vfr { color: #34d399; background: rgba(52, 211, 153, 0.12); }
    .cat--mvfr { color: #60a5fa; background: rgba(96, 165, 250, 0.14); }
    .cat--ifr { color: #f87171; background: rgba(248, 113, 113, 0.14); }
    .cat--lifr { color: #e879f9; background: rgba(232, 121, 249, 0.14); }
    .report {
      display: flex;
      gap: 10px;
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.25);
    }
    .report__label {
      flex: none;
      width: 44px;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1.6;
      color: var(--text-muted);
    }
    .report code { min-width: 0; font-family: var(--mono); font-size: 0.75rem; line-height: 1.5; overflow-wrap: anywhere; }
    .fly__note { margin: 14px 0 0; font-size: 0.75rem; color: var(--text-muted); }
    @keyframes rise {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: none; }
    }
    @media (max-width: 760px) {
      :host { padding: 16px; }
      .fly__airports { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class FlyIt {
  private readonly api = inject(FlightPulseApi);

  readonly callsign = input.required<string>();
  readonly icao24 = input.required<string>();
  /** Current altitude in feet, when the aircraft is level (so likely at cruise); otherwise null. */
  readonly cruiseFt = input<number | null>(null);

  protected readonly briefing = rxResource({
    params: () => ({ callsign: this.callsign(), icao24: this.icao24(), cruiseFt: this.cruiseFt() }),
    stream: ({ params }) => this.api.getSimBriefing(params.callsign, params.icao24, params.cruiseFt),
  });

  protected readonly legs = computed(() => {
    if (!this.briefing.hasValue()) return [];
    const { origin, destination } = this.briefing.value();
    return [
      { label: 'Departure', airport: origin },
      { label: 'Arrival', airport: destination },
    ].filter((leg): leg is { label: string; airport: SimAirport } => leg.airport != null);
  });

  protected readonly errorText = computed(() => describeHttpError(this.briefing.error()));

  /** ICAO code of the real aircraft, when known. */
  protected readonly realType = computed(() =>
    this.briefing.hasValue() ? (this.briefing.value().aircraft?.icao_type ?? null) : null,
  );
  /** The aircraft the simmer will fly: the real one unless they pick another. */
  protected readonly chosenType = linkedSignal(() => this.realType() ?? '');
  private readonly flyingRealType = computed(() => this.chosenType() === (this.realType() ?? ''));

  /** The SimBrief link with the chosen aircraft; the registration only applies to the real one. */
  protected readonly simbriefUrl = computed(() => {
    const base = this.briefing.hasValue() ? this.briefing.value().simbrief_url : null;
    if (!base) return null;
    const url = new URL(base);
    if (this.chosenType()) url.searchParams.set('type', this.chosenType());
    else url.searchParams.delete('type');
    if (!this.flyingRealType()) url.searchParams.delete('reg');
    return url.toString();
  });

  protected readonly simbriefFields = computed(() => {
    if (!this.briefing.hasValue()) return [];
    const fields = this.briefing
      .value()
      .simbrief_fields.filter((f) => f.label !== 'Aircraft type' && (this.flyingRealType() || f.label !== 'Registration'));
    if (this.chosenType()) fields.splice(Math.min(5, fields.length), 0, { label: 'Aircraft type', value: this.chosenType() });
    return fields;
  });

  /** Common airliners in simulators, as ICAO codes, for the aircraft picker. */
  protected readonly commonTypes = [
    'A19N', 'A20N', 'A21N', 'A319', 'A320', 'A321', 'A332', 'A333', 'A339', 'A359', 'A35K', 'A388',
    'AT76', 'B38M', 'B39M', 'B737', 'B738', 'B739', 'B744', 'B748', 'B752', 'B763', 'B772', 'B77W',
    'B788', 'B789', 'B78X', 'CRJ9', 'DH8D', 'E175', 'E190', 'E195',
  ];

  protected onType(event: Event): void {
    this.chosenType.set((event.target as HTMLInputElement).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
  }
  protected readonly rating = flyingConditions;
}
