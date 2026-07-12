import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SheetDirective } from './sheet.directive';

/**
 * The ONE confirm dialog — icon, question, body, cancel/confirm. Eight
 * near-identical copies used to live across the app; this keeps the shape
 * (and the a11y: appSheet focus trap, Escape, aria-label) in one place.
 * Extra content (hints, notes) projects between body and buttons.
 */
@Component({
  selector: 'app-confirm-sheet',
  imports: [SheetDirective],
  template: `
    <div class="sheet-backdrop" (click)="cancelled.emit()">
      <div
        class="sheet card confirm"
        appSheet
        (sheetClose)="cancelled.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <span class="confirm-icon" aria-hidden="true">{{ icon() }}</span>
        <h2>{{ title() }}</h2>
        @if (body()) {
          <p class="confirm-body">{{ body() }}</p>
        }
        <ng-content />
        <div class="row">
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
            {{ cancelLabel() || i18n.t().common.cancel }}
          </button>
          <button type="button" class="btn btn-primary" (click)="confirmed.emit()">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmSheet {
  protected readonly i18n = inject(I18nService);
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input<string>('');
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
