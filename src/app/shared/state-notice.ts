import { Component, computed, input, output } from '@angular/core';

/** Loading / error / empty placeholder shared by all panels. */
@Component({
  selector: 'app-state-notice',
  template: `
    <div
      class="notice"
      [class.notice--error]="kind() === 'error'"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
    >
      @if (kind() === 'loading') {
        <span class="loader" aria-hidden="true"></span>
      }
      @if (heading()) {
        <strong>{{ heading() }}</strong>
      }
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (label()) {
        <button type="button" class="btn btn--ghost" (click)="action.emit()">{{ label() }}</button>
      }
    </div>
  `,
})
export class StateNotice {
  readonly kind = input<'loading' | 'error' | 'empty'>('empty');
  readonly heading = input('');
  readonly message = input('');
  readonly actionLabel = input('');
  readonly action = output<void>();

  protected readonly label = computed(
    () => this.actionLabel() || (this.kind() === 'error' ? 'Try again' : ''),
  );
}
