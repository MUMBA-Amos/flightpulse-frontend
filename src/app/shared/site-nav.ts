import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Brand } from './brand';

/**
 * Site-wide navigation bar: logo, page links and any page-specific actions
 * passed as content (e.g. the dashboard's Refresh button). On narrow screens
 * the links fold into a menu. Stays at the top of the page while scrolling.
 */
@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive, Brand],
  template: `
    <header class="nav">
      <app-brand />

      <nav class="nav__links" [class.nav__links--open]="menuOpen()" aria-label="Main">
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="nav__link--active"
            [routerLinkActiveOptions]="{ exact: link.path === '/' }"
            ariaCurrentWhenActive="page"
            class="nav__link"
            (click)="menuOpen.set(false)"
          >
            {{ link.label }}
          </a>
        }
      </nav>

      <div class="nav__actions">
        <ng-content />
        <button
          type="button"
          class="nav__menu"
          [attr.aria-expanded]="menuOpen()"
          aria-label="Menu"
          (click)="menuOpen.set(!menuOpen())"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            @if (menuOpen()) {
              <path d="M6 6l12 12M18 6 6 18" />
            } @else {
              <path d="M4 7h16M4 12h16M4 17h16" />
            }
          </svg>
        </button>
      </div>
    </header>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 30;
      display: block;
    }

    .nav {
      position: relative;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 14px var(--gutter);
      border-bottom: 1px solid var(--border);
      background: rgba(11, 11, 12, 0.85);
      backdrop-filter: blur(10px);
    }

    .nav__links {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }

    .nav__link {
      padding: 7px 14px 6px;
      border-radius: 2px;
      font-family: var(--display);
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s, background 0.15s;

      &:hover { color: var(--text); background: rgba(200, 194, 180, 0.08); }
      &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    }

    /* The current page is lit like a yellow terminal sign. */
    .nav__link--active,
    .nav__link--active:hover {
      color: var(--on-accent);
      background: var(--accent);
    }

    .nav__actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .nav__menu {
      display: none;
      place-items: center;
      width: 38px;
      height: 38px;
      padding: 0;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      color: var(--text);
      background: rgba(19, 19, 21, 0.6);
      cursor: pointer;

      svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
      &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    }

    @media (max-width: 720px) {
      .nav { justify-content: space-between; }
      .nav__menu { display: grid; }

      .nav__links {
        position: absolute;
        top: 100%;
        right: var(--gutter);
        left: var(--gutter);
        z-index: 20;
        display: none;
        flex-direction: column;
        align-items: stretch;
        margin: 6px 0 0;
        padding: 8px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: #101012;
        box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.7);
      }

      .nav__links--open { display: flex; }
      .nav__link { padding: 12px 14px; }

    }
  `,
})
export class SiteNav {
  protected readonly menuOpen = signal(false);
  protected readonly links = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/insights', label: 'Insights' },
    { path: '/weather', label: 'Weather' },
  ];
}
