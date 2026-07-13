import { Component, input, output } from '@angular/core';

/**
 * The ONE boolean switch — a knob slider with role="switch". Two chips with
 * ✓/— glyphs used to stand in for booleans (settings timeCompass, familia
 * social); chips are for CHOICE GROUPS, switches are for on/off (A6, 0.0.77).
 * Styles are self-contained on purpose — the ConfirmSheet lesson: feature-
 * scoped scss never reaches a shared component's DOM.
 */
@Component({
  selector: 'app-switch',
  template: `
    <button
      type="button"
      class="switch"
      role="switch"
      [attr.id]="buttonId() || null"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="ariaLabel() || null"
      [disabled]="disabled()"
      (click)="toggled.emit()"
    >
      <span class="knob" [class.on]="checked()"></span>
    </button>
  `,
  styles: `
    .switch {
      width: 56px;
      height: 32px;
      border-radius: 999px;
      border: 1.5px solid var(--border-strong);
      background: var(--surface-2);
      position: relative;
      cursor: pointer;
      flex-shrink: 0;

      &:disabled {
        opacity: 0.55;
        cursor: default;
      }

      .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--text-faint);
        transition: transform 0.2s ease, background 0.2s ease;

        &.on {
          transform: translateX(24px);
          background: var(--primary);
        }
      }
    }
  `,
})
export class Switch {
  readonly checked = input.required<boolean>();
  /** Forwarded to the button so an outer <label for="…"> keeps working. */
  readonly buttonId = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly disabled = input(false);
  readonly toggled = output<void>();
}
