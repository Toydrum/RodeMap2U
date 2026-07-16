import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Preserve } from '../../core/db/schema';
import { membersOf } from '../../core/harvest';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { FruitGlyph } from '../forest/fruit';
import { fruitFor, jamTint } from '../forest/flora';
import { hash } from '../forest/tree-layout';

/**
 * «Hacer tu mermelada» (0.0.96) — the cook ceremony for a FULL goal jar. When a
 * frasco prometido gathers its capacity, filling is the achievement; the user
 * MAKES the jam here (the app never self-seals). The jar's own fruits simmer in
 * the pot (already gathered — no picking), stir is play, «Envasar» seals it (the
 * caller does the actual seal, keeping the premio). DOORS CANCEL: dismissing is
 * a pure no-op. Self-styled (sheet law); reuses the mermelada pot visuals.
 */
@Component({
  selector: 'app-hacer-mermelada-sheet',
  imports: [SheetDirective, FruitGlyph],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card make-sheet"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().cosecha.promise.makeTitle"
      >
        <h2>{{ i18n.t().cosecha.promise.makeTitle }}</h2>
        <p class="hint">{{ i18n.t().cosecha.promise.makeHint }}</p>

        <div class="pot-zone">
          <svg class="pot on-fire" [class.stirring]="stirring()" viewBox="0 0 120 92" width="200" height="153" aria-hidden="true">
            <g class="steam" aria-hidden="true">
              <path class="wisp w1" d="M 48 14 C 44 8 52 4 48 -2" />
              <path class="wisp w2" d="M 72 12 C 76 6 68 2 72 -4" />
            </g>
            <path class="pot-body" d="M 18 26 L 102 26 C 104 50 94 70 60 70 C 26 70 16 50 18 26 Z" />
            <ellipse class="jam-surface" cx="60" cy="26" rx="40" ry="6.4" [attr.fill]="tint().tint" opacity="0.5" />
            <ellipse class="jam-swirl" cx="60" cy="26" rx="26" ry="4" fill="none" [attr.stroke]="tint().tintEdge" stroke-width="1.4" opacity="0.55" />
            @for (f of potFruits(); track f.key) {
              <g class="pot-fruit" [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.rot + ')'">
                <g appFruit [fruit]="f.spec" [scale]="0.8" />
              </g>
            }
            <path class="pot-handle" d="M 14 30 Q 2 32 8 42" />
            <path class="pot-handle" d="M 106 30 Q 118 32 112 42" />
            <g class="flame" aria-hidden="true">
              <path d="M 52 82 Q 56 74 60 82 Q 64 74 68 82" />
            </g>
          </svg>
          <span class="pot-tag">{{ preserve().name }}</span>
        </div>

        <div class="row-actions">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">{{ i18n.t().common.cancel }}</button>
          <button type="button" class="btn btn-soft" (click)="stir()">{{ i18n.t().cosecha.stir }}</button>
          <button type="button" class="btn btn-primary make-btn" [disabled]="making()" (click)="make()">
            {{ i18n.t().cosecha.jarIt }}
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

    .pot-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      margin-bottom: 1rem;
    }

    .pot-body {
      fill: color-mix(in srgb, var(--rm-bark) 55%, var(--surface-2));
      stroke: color-mix(in srgb, var(--text) 40%, transparent);
      stroke-width: 1.4;
    }

    .pot-handle {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 45%, transparent);
      stroke-width: 2.2;
      stroke-linecap: round;
    }

    .pot-fruit {
      animation: pot-drop 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both;
    }

    @keyframes pot-drop {
      from {
        transform: translate(var(--tx, 0), -26px) scale(0.5);
        opacity: 0;
      }
    }

    .pot-tag {
      font-weight: 700;
      font-size: 0.9rem;
    }

    .flame path {
      fill: none;
      stroke: color-mix(in srgb, #e8964f 75%, var(--surface));
      stroke-width: 2.4;
      stroke-linecap: round;
      animation: flame-breathe 2.6s ease-in-out infinite;
    }

    @keyframes flame-breathe {
      0%,
      100% {
        opacity: 0.55;
      }
      50% {
        opacity: 0.95;
      }
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

    .pot.stirring .jam-swirl {
      animation: swirl 0.9s ease-in-out;
    }

    @keyframes swirl {
      0% {
        transform: rotate(0deg);
      }
      50% {
        transform: rotate(8deg) scale(0.94);
      }
      100% {
        transform: rotate(0deg);
      }
    }

    .jam-swirl {
      transform-origin: 60px 26px;
      transform-box: view-box;
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    :host-context(.reduce-motion) {
      .pot-fruit {
        animation: none;
      }
      .flame path,
      .wisp {
        animation: none;
        opacity: 0.5;
      }
    }
  `,
})
export class HacerMermeladaSheet {
  protected readonly i18n = inject(I18nService);
  private readonly harvests = inject(HarvestsRepo);

  readonly preserve = input.required<Preserve>();
  readonly closed = output<void>();
  readonly made = output<void>();

  protected readonly making = signal(false);
  protected readonly stirring = signal(false);

  private readonly members = computed(() =>
    membersOf(this.preserve().id, this.harvests.all()),
  );

  protected readonly tint = computed(() => jamTint(this.members().map((m) => m.accent)));

  /** The jar's fruits scattered over the pot's belly — id-stable. */
  protected readonly potFruits = computed(() =>
    this.members().map((h) => ({
      key: h.id,
      x: 34 + (hash(h.id + ':px') % 53),
      y: 34 + (hash(h.id + ':py') % 22),
      rot: -18 + (hash(h.id + ':pr') % 37),
      spec: fruitFor(h.accent, h.treeId),
    })),
  );

  protected stir(): void {
    this.stirring.set(false);
    requestAnimationFrame(() => this.stirring.set(true));
    setTimeout(() => this.stirring.set(false), 950);
  }

  protected make(): void {
    if (this.making()) return;
    this.making.set(true);
    this.made.emit();
  }
}
