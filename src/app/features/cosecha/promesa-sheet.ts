import { Component, computed, inject, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { JarVessel, Preserve } from '../../core/db/schema';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { inputValue } from '../../shared/ui/dom';
import { PromiseJar } from '../forest/promise-jar';
import { PromiseService } from './promise.service';

/**
 * «Prometer un frasco» (0.0.93) — the goal-jar wizard. Three beats, DOORS
 * CANCEL (dismissing at any beat is a pure no-op — nothing is minted until the
 * final «Prometer»). Unlike the pot ritual, the premio is REQUIRED here (a
 * promise IS its reward) and the vessel is chosen forward — «el frasco sirve a
 * la fruta» becomes the user's OWN valuation of their premio (the app never
 * suggests reward↔size). Capacity is stated once, in words + a number, as an
 * honest fact of the vessel — never a «te falta N» on any working surface.
 * Styles self-contained (sheet law); chip look comes from the global .chip.
 */
@Component({
  selector: 'app-promesa-sheet',
  imports: [SheetDirective, PromiseJar],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card promesa-sheet"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().cosecha.promise.title"
      >
        @switch (beat()) {
          @case (1) {
            <h2>{{ i18n.t().cosecha.promise.beat1Title }}</h2>
            <p class="hint">{{ i18n.t().cosecha.promise.beat1Hint }}</p>

            <div class="field">
              <input
                id="promise-premio"
                type="text"
                maxlength="120"
                [value]="premio()"
                (input)="premio.set(inputValue($event))"
                [placeholder]="i18n.t().cosecha.premioPlaceholder"
                [attr.aria-label]="i18n.t().cosecha.promise.beat1Title"
              />
            </div>
            @if (premio().trim()) {
              <div class="field saved-for-field">
                <label for="promise-saved-for">{{ i18n.t().cosecha.savedForLabel }}</label>
                <input
                  id="promise-saved-for"
                  type="text"
                  maxlength="120"
                  [value]="savedFor()"
                  (input)="savedFor.set(inputValue($event))"
                  [placeholder]="i18n.t().cosecha.savedForPlaceholder"
                />
              </div>
            }

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="closed.emit()">
                {{ i18n.t().common.cancel }}
              </button>
              <button
                type="button"
                class="btn btn-primary premise-next"
                [disabled]="!premio().trim()"
                (click)="beat.set(2)"
              >
                {{ i18n.t().common.next }}
              </button>
            </div>
          }
          @case (2) {
            <h2>{{ i18n.t().cosecha.promise.beat2Title }}</h2>
            <p class="hint">{{ i18n.t().cosecha.promise.beat2Hint }}</p>

            <div class="vessel-preview" aria-hidden="true">
              <app-promise-jar [fruits]="[]" [vessel]="size()" [size]="1.5" />
            </div>

            <div class="vessel-choices" role="radiogroup" [attr.aria-label]="i18n.t().cosecha.promise.beat2Title">
              @for (opt of vessels; track opt.size) {
                <button
                  type="button"
                  class="chip vessel-chip"
                  role="radio"
                  [class.selected]="size() === opt.size"
                  [attr.aria-checked]="size() === opt.size"
                  (click)="size.set(opt.size)"
                >
                  {{ i18n.t().cosecha.promise[opt.key] }}
                </button>
              }
            </div>

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="beat.set(1)">← {{ i18n.t().common.back }}</button>
              <button type="button" class="btn btn-primary premise-next" (click)="beat.set(3)">
                {{ i18n.t().common.next }}
              </button>
            </div>
          }
          @case (3) {
            <h2>{{ i18n.t().cosecha.promise.beat3Title }}</h2>

            <div class="vessel-preview" aria-hidden="true">
              <app-promise-jar [fruits]="[]" [vessel]="size()" [size]="1.5" />
            </div>

            <div class="field">
              <input
                id="promise-name"
                type="text"
                maxlength="60"
                [value]="name()"
                (input)="name.set(inputValue($event))"
                [placeholder]="i18n.t().cosecha.promise.namePlaceholder"
                [attr.aria-label]="i18n.t().cosecha.promise.beat3Title"
              />
            </div>

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="beat.set(2)">← {{ i18n.t().common.back }}</button>
              <button
                type="button"
                class="btn btn-primary create-btn"
                [disabled]="creating()"
                (click)="create()"
              >
                {{ i18n.t().cosecha.promise.create }}
              </button>
            </div>
          }
        }
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
      width: min(560px, 100%);
      max-height: 88vh;
      overflow-y: auto;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      padding: 1.4rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom));
      animation: sheet-up 0.28s ease both;
    }

    @keyframes sheet-up {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
    }

    h2 {
      margin-bottom: 0.3rem;
    }

    .hint {
      color: var(--text-dim);
      font-size: 0.9rem;
      margin-bottom: 0.9rem;
    }

    .field {
      margin-bottom: 0.7rem;

      input {
        width: 100%;
      }
    }

    .saved-for-field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .vessel-preview {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .vessel-choices {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.1rem;
    }

    .vessel-chip {
      width: 100%;
      justify-content: center;
      text-align: center;
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    :host-context(.reduce-motion) .sheet {
      animation: none;
    }
  `,
})
export class PromesaSheet {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  private readonly promise = inject(PromiseService);

  readonly closed = output<void>();
  readonly created = output<Preserve>();

  protected readonly beat = signal<1 | 2 | 3>(1);
  protected readonly premio = signal('');
  protected readonly savedFor = signal('');
  protected readonly size = signal<JarVessel>('frasco');
  protected readonly name = signal('');
  protected readonly creating = signal(false);

  protected readonly vessels = [
    { size: 'frasquito' as JarVessel, key: 'capFrasquito' as const },
    { size: 'frasco' as JarVessel, key: 'capFrasco' as const },
    { size: 'frascote' as JarVessel, key: 'capFrascote' as const },
  ];

  protected async create(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      const jar = await this.promise.create({
        name: this.name(),
        size: this.size(),
        premio: this.premio(),
        savedFor: this.savedFor(),
      });
      if (jar) this.created.emit(jar);
      else this.closed.emit();
    } finally {
      this.creating.set(false);
    }
  }
}
