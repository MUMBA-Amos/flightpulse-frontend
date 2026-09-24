import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Brand } from './brand';

/** Site-wide footer: navigation, data-source credits and a usage disclaimer. */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, Brand],
  template: `
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__about">
          <app-brand />
          <p>Live aircraft positions, flight delays, airline performance and airport weather in one view.</p>
        </div>

        <nav class="footer__col" aria-label="Site">
          <h2>Explore</h2>
          <a routerLink="/">Home</a>
          <a routerLink="/dashboard">Dashboard</a>
          <a routerLink="/insights">Delay insights</a>
          <a routerLink="/weather">Airport weather</a>
        </nav>

        <div class="footer__col">
          <h2>Data sources</h2>
          <a href="https://opensky-network.org" target="_blank" rel="noopener">OpenSky Network</a>
          <a href="https://aviationstack.com" target="_blank" rel="noopener">Aviationstack</a>
          <a href="https://aviationweather.gov" target="_blank" rel="noopener">Aviation Weather Center</a>
          <a href="https://www.adsbdb.com" target="_blank" rel="noopener">adsbdb</a>
        </div>
      </div>

      <div class="footer__base">
        <span>© {{ year }} FlightPulse</span>
        <span>Plane positions are estimated between updates. For information only, not for navigation.</span>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: 48px;
      border-top: 1px solid var(--border);
      background: rgba(8, 12, 20, 0.6);
    }

    .footer__inner {
      display: grid;
      grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
      gap: 32px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 40px var(--gutter) 32px;
    }

    .footer__about p {
      max-width: 360px;
      margin: 14px 0 0;
      font-size: 0.85rem;
      line-height: 1.6;
      color: var(--text-muted);
    }

    .footer__col {
      display: flex;
      flex-direction: column;
      gap: 10px;

      h2 {
        margin: 0 0 4px;
        font-family: var(--mono);
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent);
      }

      a {
        width: fit-content;
        font-size: 0.85rem;
        color: var(--text-muted);
        text-decoration: none;

        &:hover { color: var(--text); }
        &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
      }
    }

    .footer__base {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px 24px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 16px var(--gutter) 24px;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    @media (max-width: 720px) {
      .footer__inner { grid-template-columns: 1fr 1fr; }
      .footer__about { grid-column: 1 / -1; }
    }
  `,
})
export class SiteFooter {
  protected readonly year = new Date().getFullYear();
}
