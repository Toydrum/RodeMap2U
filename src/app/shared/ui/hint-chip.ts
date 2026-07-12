import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../core/repos/settings.service';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * «¿Qué es esto?» — a one-line, first-visit orientation chip per surface
 * (COGA: provide help in context). Shows until dismissed, then never
 * again (Settings.hintsSeen). Links to the full guide. Never blocks,
 * never floats over content, never comes back.
 */
@Component({
  selector: 'app-hint-chip',
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <div class="hint-chip" role="note">
        <span class="hint-text">{{ text() }}</span>
        <a routerLink="/guide" class="hint-guide">{{ i18n.t().hints.guideLink }}</a>
        <button type="button" class="hint-ok" (click)="dismiss()">
          {{ i18n.t().hints.gotIt }}
        </button>
      </div>
    }
  `,
  styles: `
    .hint-chip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0.5rem 0;
      padding: 0.45rem 0.7rem;
      border-radius: var(--radius);
      border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent);
      background: color-mix(in srgb, var(--surface) 75%, transparent);
      font-size: 0.85rem;
      color: var(--text-dim);
    }

    .hint-text {
      flex: 1 1 14rem;
    }

    .hint-guide {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
      }
    }

    .hint-ok {
      border: none;
      background: var(--surface-2);
      border-radius: 999px;
      padding: 0.25rem 0.7rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-dim);
      cursor: pointer;

      &:hover {
        background: var(--surface);
        color: var(--text);
      }
    }
  `,
})
export class HintChip {
  protected readonly i18n = inject(I18nService);
  private readonly settings = inject(SettingsService);

  /** Stable surface key ('forest' | 'tree' | 'ahora' | 'timer'). */
  readonly surface = input.required<string>();
  readonly text = input.required<string>();

  protected readonly visible = computed(
    () => !(this.settings.settings().hintsSeen ?? []).includes(this.surface()),
  );

  protected dismiss(): void {
    const seen = this.settings.settings().hintsSeen ?? [];
    void this.settings.patch({ hintsSeen: [...seen, this.surface()] });
  }
}
