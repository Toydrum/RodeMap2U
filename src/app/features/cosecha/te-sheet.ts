import { Component, computed, inject, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { FruitGlyph } from '../forest/fruit';
import { fruitFor, jamTint } from '../forest/flora';
import { hash } from '../forest/tree-layout';
import { today } from '../../core/time';

/**
 * «Preparar un té» (0.0.89) — the savoring ritual. Nothing moves, nothing
 * persists, nothing counts: pick one to three fruits (or let the day pick —
 * deterministic, same blend all day), the cup steams in their blended
 * tint, and each sip re-reads one memory at the user's pace — including
 * the branch's own notita when it still holds words. Closing leaves NO
 * record anywhere; some joys are for drinking, not keeping (that absence
 * is what makes mermelada's permanence special). Styles self-contained.
 */
@Component({
  selector: 'app-te-sheet',
  imports: [SheetDirective, FruitGlyph],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card te-sheet"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().cosecha.teaTitle"
      >
        @if (!brewing()) {
          <h2>{{ i18n.t().cosecha.teaTitle }}</h2>
          <p class="hint">{{ i18n.t().cosecha.teaIntro }}</p>
          <p class="hint quiet">{{ i18n.t().cosecha.teaPick }}</p>

          <ul class="tray">
            @for (row of tray(); track row.harvest.id) {
              <li>
                <button
                  type="button"
                  class="tea-pick"
                  [class.picked]="picked().has(row.harvest.id)"
                  [disabled]="!picked().has(row.harvest.id) && picked().size >= 3"
                  [attr.aria-pressed]="picked().has(row.harvest.id)"
                  (click)="toggle(row.harvest.id)"
                >
                  <svg viewBox="-14 -15 28 28" width="24" height="24" aria-hidden="true">
                    <g appFruit [fruit]="row.spec" [scale]="0.85" />
                  </svg>
                  <span class="pick-title">{{ row.harvest.title }}</span>
                </button>
              </li>
            }
          </ul>

          <div class="row-actions">
            <button type="button" class="btn btn-ghost" (click)="surprise()">
              {{ i18n.t().cosecha.teaSurprise }}
            </button>
            <button type="button" class="btn btn-primary tea-brew" [disabled]="!picked().size" (click)="brew()">
              {{ i18n.t().cosecha.teaBrew }}
            </button>
          </div>
        } @else {
          <div class="cup-zone">
            <svg class="cup" viewBox="0 0 120 84" width="170" height="119" aria-hidden="true">
              <g class="steam" aria-hidden="true">
                <path class="wisp w1" d="M 48 22 C 44 16 52 12 48 6" />
                <path class="wisp w2" d="M 66 20 C 70 14 62 10 66 4" />
              </g>
              <path class="cup-body" d="M 24 30 L 96 30 C 96 56 84 70 60 70 C 36 70 24 56 24 30 Z" />
              <ellipse class="tea-surface" cx="60" cy="30" rx="36" ry="6" [attr.fill]="blendTint()" />
              <path class="cup-handle" d="M 96 36 Q 112 38 104 52 Q 100 58 92 56" />
              <ellipse class="saucer" cx="60" cy="74" rx="42" ry="5" />
            </svg>
          </div>

          @if (sipRow(); as row) {
            <div class="sip-card" role="status">
              <svg viewBox="-14 -15 28 28" width="30" height="30" aria-hidden="true">
                <g appFruit [fruit]="row.spec" [scale]="1" />
              </svg>
              <div class="sip-words">
                <strong>{{ row.harvest.title }}</strong>
                <span class="sip-meta">{{ row.harvest.treeName }} · {{ row.when }}</span>
                @if (row.note) {
                  <p class="sip-note">«{{ row.note }}»</p>
                }
              </div>
            </div>
          }

          <div class="row-actions">
            @if (sipIndex() < brewRows().length - 1) {
              <button type="button" class="btn btn-primary tea-sip" (click)="sipIndex.set(sipIndex() + 1)">
                {{ i18n.t().cosecha.teaSip }}
              </button>
            } @else {
              <button type="button" class="btn btn-primary tea-end" (click)="closed.emit()">
                {{ i18n.t().cosecha.teaEnd }}
              </button>
            }
          </div>
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
      margin-bottom: 0.4rem;

      &.quiet {
        color: var(--text-faint);
        margin-bottom: 0.8rem;
      }
    }

    .tray {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.5rem;
      max-height: 38vh;
      overflow-y: auto;
    }

    .tea-pick {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.45rem 0.6rem;
      border: 1.5px solid color-mix(in srgb, var(--text) 16%, transparent);
      border-radius: 12px;
      background: var(--surface);
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;

      &.picked {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 10%, var(--surface));
      }

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .pick-title {
        min-width: 0;
        font-size: 0.82rem;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .cup-zone {
      display: flex;
      justify-content: center;
      margin-bottom: 0.8rem;
    }

    .cup-body {
      fill: var(--surface);
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 1.6;
    }

    .cup-handle {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 1.6;
    }

    .saucer {
      fill: color-mix(in srgb, var(--text) 10%, var(--surface));
      stroke: color-mix(in srgb, var(--text) 30%, transparent);
      stroke-width: 1;
    }

    .wisp {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 25%, transparent);
      stroke-width: 1.6;
      stroke-linecap: round;
      animation: wisp-rise 3.4s ease-in-out infinite;
    }

    .wisp.w2 {
      animation-delay: 1.7s;
    }

    @keyframes wisp-rise {
      0% {
        transform: translateY(4px);
        opacity: 0;
      }
      40% {
        opacity: 0.6;
      }
      100% {
        transform: translateY(-7px);
        opacity: 0;
      }
    }

    .sip-card {
      display: flex;
      align-items: flex-start;
      gap: 0.7rem;
      padding: 0.8rem 1rem;
      border: 1.5px solid color-mix(in srgb, var(--text) 14%, transparent);
      border-radius: 14px;
      margin-bottom: 1rem;
      animation: sip-in 0.3s ease both;
    }

    @keyframes sip-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }

    .sip-words {
      min-width: 0;

      strong {
        display: block;
        overflow-wrap: anywhere;
      }
    }

    .sip-meta {
      color: var(--text-faint);
      font-size: 0.8rem;
    }

    .sip-note {
      margin: 0.4rem 0 0;
      font-style: italic;
      overflow-wrap: anywhere;
    }

    :host-context(.reduce-motion) {
      .wisp {
        animation: none;
        opacity: 0.4;
      }

      .sip-card {
        animation: none;
      }
    }
  `,
})
export class TeSheet {
  protected readonly i18n = inject(I18nService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly nodes = inject(NodesRepo);

  readonly closed = output<void>();

  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly brewing = signal(false);
  protected readonly sipIndex = signal(0);
  /** Frozen at brew — the cup doesn't reshuffle mid-sip. */
  private readonly brewIds = signal<string[]>([]);

  /** Any fruit, any home — nothing moves for a tea. */
  protected readonly tray = computed(() =>
    this.harvests.newestFirst().map((harvest) => ({
      harvest,
      spec: fruitFor(harvest.accent, harvest.treeId),
    })),
  );

  protected readonly brewRows = computed(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    return this.brewIds()
      .map((id) => this.harvests.byId().get(id))
      .filter((h): h is NonNullable<typeof h> => !!h)
      .map((harvest) => ({
        harvest,
        spec: fruitFor(harvest.accent, harvest.treeId),
        when: new Date(harvest.harvestedAt).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
        }),
        note: this.nodes.byId().get(harvest.nodeId)?.note?.trim() ?? '',
      }));
  });

  protected readonly sipRow = computed(() => this.brewRows()[this.sipIndex()] ?? null);

  protected readonly blendTint = computed(() => {
    const rows = this.brewRows().length ? this.brewRows() : [];
    if (!rows.length) return 'var(--surface-2)';
    return jamTint(rows.map((r) => r.harvest.accent)).tint;
  });

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 3) {
      next.add(id);
    }
    this.picked.set(next);
  }

  /** The day picks — deterministic, the same blend all day (rule 4). */
  protected surprise(): void {
    const all = this.harvests.newestFirst();
    if (!all.length) return;
    const chosen = new Set<string>();
    const want = Math.min(3, all.length);
    for (let i = 0; chosen.size < want && i < want * 4; i++) {
      chosen.add(all[hash(today() + ':te' + i) % all.length].id);
    }
    this.picked.set(chosen);
  }

  protected brew(): void {
    this.brewIds.set([...this.picked()]);
    this.sipIndex.set(0);
    this.brewing.set(true);
  }
}
