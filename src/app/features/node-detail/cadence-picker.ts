import { Component, computed, inject, input, output } from '@angular/core';
import { Weekday } from '../../core/db/schema';
import { Cadence } from '../../core/cadence';
import { I18nService } from '../../core/i18n/i18n.service';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * «El ritmo» (0.0.103) — the shared cadence picker, used by all three
 * creation doors (node sheet, plant sheet, the almanaque ghost stone).
 * Three chips: cada día · solo estos días (7 letter toggles) · cada semana
 * (the low-pressure one — any day, the week turns on Monday). Emits a
 * Cadence; never lets the weekday list go empty (the last day stays).
 */
@Component({
  selector: 'app-cadence-picker',
  template: `
    <div class="cadence-chips" role="radiogroup" [attr.aria-label]="i18n.t().cadence.aria">
      <button
        type="button"
        class="cadence-chip cadence-daily"
        [class.selected]="kind() === 'daily'"
        [attr.aria-pressed]="kind() === 'daily'"
        (click)="pickDaily()"
      >
        🌄 {{ i18n.t().cadence.daily }}
      </button>
      <button
        type="button"
        class="cadence-chip cadence-days"
        [class.selected]="kind() === 'days'"
        [attr.aria-pressed]="kind() === 'days'"
        (click)="pickDays()"
      >
        📆 {{ i18n.t().cadence.days }}
      </button>
      <button
        type="button"
        class="cadence-chip cadence-weekly"
        [class.selected]="kind() === 'weekly'"
        [attr.aria-pressed]="kind() === 'weekly'"
        (click)="pickWeekly()"
      >
        🌿 {{ i18n.t().cadence.weekly }}
      </button>
    </div>
    @if (kind() === 'weekly') {
      <p class="cadence-hint">{{ i18n.t().cadence.weeklyHint }}</p>
    }
    @if (kind() === 'days') {
      <div class="weekday-row" role="group" [attr.aria-label]="i18n.t().cadence.days">
        @for (d of weekdays; track d) {
          <button
            type="button"
            class="weekday-toggle"
            [class.selected]="isOn(d)"
            [attr.aria-pressed]="isOn(d)"
            [attr.aria-label]="i18n.t().cadence.weekdayNames[d]"
            (click)="toggleDay(d)"
          >
            {{ i18n.t().cadence.weekdayLetters[d] }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .cadence-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .cadence-chip {
      padding: 0.32rem 0.7rem;
      border: 1.5px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      font: inherit;
      font-size: 0.85rem;
      color: var(--text-dim);
      cursor: pointer;

      &.selected {
        border-color: var(--primary);
        color: var(--text);
        background: color-mix(in srgb, var(--primary) 12%, var(--surface));
      }
    }

    .cadence-hint {
      margin: 0.35rem 0 0;
      font-size: 0.78rem;
      color: var(--text-faint);
    }

    .weekday-row {
      display: flex;
      gap: 0.35rem;
      margin-top: 0.45rem;
    }

    .weekday-toggle {
      width: 2rem;
      height: 2rem;
      border: 1.5px solid var(--border);
      border-radius: 50%;
      background: var(--surface);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-faint);
      cursor: pointer;

      &.selected {
        border-color: var(--primary);
        color: var(--text);
        background: color-mix(in srgb, var(--primary) 16%, var(--surface));
      }
    }
  `,
})
export class CadencePicker {
  protected readonly i18n = inject(I18nService);
  protected readonly weekdays = WEEKDAYS;

  readonly value = input.required<Cadence>();
  readonly changed = output<Cadence>();

  protected readonly kind = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? 'days' : v;
  });

  protected isOn(d: Weekday): boolean {
    const v = this.value();
    return Array.isArray(v) && v.includes(d);
  }

  protected pickDaily(): void {
    if (this.value() !== 'daily') this.changed.emit('daily');
  }

  protected pickWeekly(): void {
    if (this.value() !== 'weekly') this.changed.emit('weekly');
  }

  protected pickDays(): void {
    if (!Array.isArray(this.value())) this.changed.emit(['mon']);
  }

  protected toggleDay(d: Weekday): void {
    const v = this.value();
    if (!Array.isArray(v)) return;
    if (v.includes(d)) {
      const next = v.filter((x) => x !== d);
      if (next.length) this.changed.emit(next); // the last day stays — never empty
    } else {
      this.changed.emit(WEEKDAYS.filter((x) => v.includes(x) || x === d));
    }
  }
}
