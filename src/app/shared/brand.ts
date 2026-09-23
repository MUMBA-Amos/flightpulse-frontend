import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="brand" aria-label="FlightPulse home">
      <svg class="brand__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
      </svg>
      <span>
        <span class="brand__name">FlightPulse</span>
        <span class="brand__tag">Live flight operations</span>
      </span>
    </a>
  `,
  styles: `
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: inherit;
      text-decoration: none;
      &:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 6px; }
    }
    .brand__icon {
      width: 34px;
      height: 34px;
      padding: 6px;
      border-radius: 10px;
      fill: var(--accent);
      background: var(--accent-soft);
      transform: rotate(45deg);
    }
    .brand__name {
      display: block;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .brand__tag {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `,
})
export class Brand {}
