import { Component, input } from '@angular/core';

import { WeatherKind } from './weather-format';

/** Line icon for a weather condition; inherits size and colour from the parent. */
@Component({
  selector: 'app-weather-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('clear') {
          <circle cx="12" cy="12" r="4" class="sun" />
          <path class="sun" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        }
        @case ('partly') {
          <path class="sun" d="M8 2v1.5M3.8 3.8l1 1M2 8h1.5M12.2 3.8l-1 1" />
          <path class="sun" d="M5.3 10.2A3.5 3.5 0 0 1 11 5.6" />
          <path d="M17.5 20H8a4 4 0 1 1 .9-7.9A5 5 0 0 1 18.3 12a4 4 0 0 1-.8 8z" />
        }
        @case ('cloudy') {
          <path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8z" />
        }
        @case ('rain') {
          <path d="M17.5 15H8a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 19.5 8a3.5 3.5 0 0 1-2 7z" />
          <path class="drop" d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
        }
        @case ('snow') {
          <path d="M17.5 15H8a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 19.5 8a3.5 3.5 0 0 1-2 7z" />
          <path class="drop" d="M8 19h.01M12 21h.01M16 19h.01M10 22h.01M14 18h.01" />
        }
        @case ('storm') {
          <path d="M17.5 15H8a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 19.5 8a3.5 3.5 0 0 1-2 7z" />
          <path class="sun" d="M13 15l-2.5 4h3l-2 4" />
        }
        @case ('fog') {
          <path d="M16.5 12H8a4 4 0 1 1 1-7.9A5 5 0 0 1 18.5 6a3 3 0 0 1-2 6z" />
          <path class="drop" d="M4 16h16M6 20h12" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 1em; height: 1em; flex: none; }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .sun { stroke: #ffc72c; }
    .drop { stroke: #7dd3fc; }
  `,
})
export class WeatherIcon {
  readonly kind = input.required<WeatherKind>();
}
