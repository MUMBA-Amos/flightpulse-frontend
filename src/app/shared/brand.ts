import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="brand" aria-label="FlightPulse home">
      <img class="brand__icon" src="logo.svg" alt="" width="36" height="36" />
      <span>
        <span class="brand__name">Flight<span class="brand__accent">Pulse</span></span>
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
      display: block;
      width: 36px;
      height: 36px;
    }
    .brand__name {
      display: block;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .brand__accent { color: var(--accent); }
    .brand__tag {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `,
})
export class Brand {}
