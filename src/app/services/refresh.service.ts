import { Injectable, effect, inject, signal, untracked } from '@angular/core';

/** How often live data is reloaded automatically. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

/**
 * Broadcasts "refresh everything" to whichever panels are alive, from the
 * top bar's Refresh button, and automatically every AUTO_REFRESH_MS while the
 * tab is visible.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly count = signal(0);
  readonly tick = this.count.asReadonly();

  constructor() {
    setInterval(() => {
      if (!document.hidden) this.refresh();
    }, AUTO_REFRESH_MS);
  }

  refresh(): void {
    this.count.update((n) => n + 1);
  }
}

/**
 * Reloads the given resources whenever RefreshService.refresh() is called.
 * Uses reload() so the previous data stays visible while new data loads.
 * Must be called in an injection context (e.g. a constructor).
 */
export function reloadOnRefresh(...resources: { reload(): boolean }[]): void {
  const tick = inject(RefreshService).tick;
  const initial = untracked(tick);

  effect(() => {
    if (tick() === initial) return;
    untracked(() => resources.forEach((r) => r.reload()));
  });
}
