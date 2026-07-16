import { Component, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Tree } from '../../core/db/schema';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { inputValue } from '../../shared/ui/dom';

/**
 * «La despedida» (0.0.95) — the closing ritual when you archive a tree that
 * bore fruit (an area of your life reaching its end). DOORS CANCEL: dismissing
 * is a pure no-op (nothing is archived until «Guardar la despedida»). It asks
 * ONE gentle compass question — «¿Qué te llevas de este capítulo?» — whose
 * answer becomes the elixir's «lo que me llevo» (optional; never forced). The
 * forest owns the actual archive + distill + undo. Self-styled (sheet law).
 */
@Component({
  selector: 'app-despedida-sheet',
  imports: [SheetDirective],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card despedida-sheet"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().cosecha.elixir.title"
      >
        <span class="vial" aria-hidden="true">🍶</span>
        <h2>{{ i18n.t().cosecha.elixir.title }}</h2>
        <p class="hint">{{ i18n.t().cosecha.elixir.body }}</p>

        <div class="field">
          <label for="carry-field">{{ i18n.t().cosecha.elixir.carryLabel }}</label>
          <input
            id="carry-field"
            type="text"
            maxlength="140"
            [value]="carry()"
            (input)="carry.set(inputValue($event))"
            [placeholder]="i18n.t().cosecha.elixir.carryPlaceholder"
          />
        </div>

        <div class="row-actions">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">
            {{ i18n.t().common.cancel }}
          </button>
          <button type="button" class="btn btn-primary keep-farewell" (click)="keep.emit(carry())">
            {{ i18n.t().cosecha.elixir.keep }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: 500;
      background: rgba(20, 26, 18, 0.45);
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .sheet {
      width: min(520px, 100%);
      max-height: 88vh;
      overflow-y: auto;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      padding: 1.4rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom));
      animation: sheet-up 0.28s ease both;
      text-align: center;
    }

    @keyframes sheet-up {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
    }

    .vial {
      font-size: 2rem;
      display: block;
    }

    h2 {
      margin-bottom: 0.3rem;
    }

    .hint {
      color: var(--text-dim);
      font-size: 0.92rem;
      margin-bottom: 1rem;
    }

    .field {
      text-align: left;
      margin-bottom: 1.1rem;

      label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }

      input {
        width: 100%;
      }
    }

    .row-actions {
      display: flex;
      justify-content: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    :host-context(.reduce-motion) .sheet {
      animation: none;
    }
  `,
})
export class DespedidaSheet {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);

  readonly tree = input.required<Tree>();
  readonly closed = output<void>();
  /** Emits the «lo que me llevo» text (may be empty). */
  readonly keep = output<string>();

  protected readonly carry = signal('');
}
