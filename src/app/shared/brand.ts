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
      &:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 3px; }
    }
    .brand__icon {
      display: block;
      width: 36px;
      height: 36px;
    }
    .brand__name {
      display: block;
      font-family: var(--display);
      font-size: 1.45rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .brand__accent { color: var(--accent); }
    .brand__tag {
      display: block;
      margin-top: 2px;
      font-family: var(--mono);
      font-size: 0.66rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
  `,
})
export class Brand {}
