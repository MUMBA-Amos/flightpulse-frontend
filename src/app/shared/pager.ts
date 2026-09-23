import { Component, computed, input } from '@angular/core';

import { PAGE_SIZES, Pagination } from './pagination';

/** "Rows per page" picker and previous/next buttons shown under a table. */
@Component({
  selector: 'app-pager',
  template: `
    @let p = pager();
    <nav class="pager" aria-label="Pages">
      <label class="pager__size">
        Rows per page
        <select class="select" [value]="p.pageSize()" (change)="onSize($event)">
          @for (size of sizes; track size) {
            <option [value]="size">{{ size }}</option>
          }
        </select>
      </label>

      <span class="pager__range">{{ first() }}–{{ last() }} of {{ p.total() }}</span>

      <div class="pager__buttons">
        <button type="button" class="btn btn--ghost" [disabled]="p.current() <= 1" (click)="p.page.set(p.current() - 1)">
          ‹ Previous
        </button>
        <span class="pager__page">Page {{ p.current() }} of {{ p.pageCount() }}</span>
        <button type="button" class="btn btn--ghost" [disabled]="p.current() >= p.pageCount()" (click)="p.page.set(p.current() + 1)">
          Next ›
        </button>
      </div>
    </nav>
  `,
  styles: `
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px 20px;
      margin-top: 14px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .pager__size { display: flex; align-items: center; gap: 8px; }
    .pager__size .select { padding-top: 6px; padding-bottom: 6px; }
    .pager__range { font-family: var(--mono); }
    .pager__buttons { display: flex; align-items: center; gap: 10px; }
    .pager__buttons .btn { padding: 6px 12px; font-size: 0.8rem; }
    .pager__buttons .btn:disabled { cursor: not-allowed; opacity: 0.4; }
    .pager__page { font-family: var(--mono); white-space: nowrap; }
  `,
})
export class Pager {
  readonly pager = input.required<Pagination<unknown>>();
  protected readonly sizes = PAGE_SIZES;

  protected readonly first = computed(() => {
    const p = this.pager();
    return p.total() === 0 ? 0 : (p.current() - 1) * p.pageSize() + 1;
  });
  protected readonly last = computed(() => {
    const p = this.pager();
    return Math.min(p.current() * p.pageSize(), p.total());
  });

  protected onSize(event: Event): void {
    this.pager().pageSize.set(Number((event.target as HTMLSelectElement).value));
  }
}
