import { Signal, WritableSignal, computed, linkedSignal, signal } from '@angular/core';

export const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export interface Pagination<T> {
  /** Rows on the current page. */
  readonly rows: Signal<T[]>;
  readonly total: Signal<number>;
  readonly pageSize: WritableSignal<number>;
  /** Requested page (1-based); use `current` for the page actually shown. */
  readonly page: WritableSignal<number>;
  readonly current: Signal<number>;
  readonly pageCount: Signal<number>;
}

/**
 * Splits `items` into pages. Goes back to page 1 whenever `resetKey` changes
 * (e.g. a filter), or the page size does.
 */
export function paginate<T>(items: () => T[], resetKey: () => string): Pagination<T> {
  const pageSize = signal(DEFAULT_PAGE_SIZE);
  const page = linkedSignal({ source: () => `${resetKey()}|${pageSize()}`, computation: () => 1 });
  const total = computed(() => items().length);
  const pageCount = computed(() => Math.max(1, Math.ceil(total() / pageSize())));
  // A data refresh can shrink the list below the current page, so clamp.
  const current = computed(() => Math.min(page(), pageCount()));
  const rows = computed(() => items().slice((current() - 1) * pageSize(), current() * pageSize()));
  return { rows, total, pageSize, page, current, pageCount };
}
