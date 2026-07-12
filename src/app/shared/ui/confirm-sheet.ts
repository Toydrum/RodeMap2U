import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SheetDirective } from './sheet.directive';

/**
 * The ONE confirm dialog — icon, question, body, cancel/confirm. Eight
 * near-identical copies used to live across the app; this keeps the shape
 * (and the a11y: appSheet focus trap, Escape, aria-label) in one place.
 * Extra content (hints, notes) projects between body and buttons.
 *
 * Styles are SELF-CONTAINED on purpose: `.sheet-backdrop`/`.confirm` are
 * feature-scoped everywhere else, so relying on the host page's scss left
 * the dialog unstyled (no fixed backdrop — shipped broken once). The global
 * `.reduce-motion` backstop still reaches the slide-up animation.
 *
 * `quiet` flips the button emphasis (cancel = primary, confirm = ghost) for
 * soft leave-taking actions the doctrine de-emphasizes (e.g. removing a
 * friend) — never a red button either way.
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
          <button
            type="button"
            class="btn"
            [class.btn-ghost]="!quiet()"
            [class.btn-primary]="quiet()"
            (click)="cancelled.emit()"
          >
            {{ cancelLabel() || i18n.t().common.cancel }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="!quiet()"
            [class.btn-ghost]="quiet()"
            [disabled]="confirmDisabled()"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: 600;
      background: rgba(20, 26, 18, 0.45);
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .sheet {
      width: min(600px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      padding: 1.4rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom));
      animation: sheet-up 0.28s ease both;
      text-align: center;
    }

    .confirm-icon {
      font-size: 2rem;
      display: block;
    }

    .confirm-body {
      color: var(--text-dim);
      font-size: 0.95rem;
    }

    .row {
      display: flex;
      justify-content: center;
      gap: 0.7rem;
    }

    @keyframes sheet-up {
      from {
        transform: translateY(48px);
        opacity: 0;
      }
    }
  `,
})
export class ConfirmSheet {
  protected readonly i18n = inject(I18nService);
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input<string>('');
  /** Soft leave-taking: swap emphasis so CANCEL is the highlighted path. */
  readonly quiet = input(false);
  readonly confirmDisabled = input(false);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
