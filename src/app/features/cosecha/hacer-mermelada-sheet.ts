import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Preserve } from '../../core/db/schema';
import { membersOf } from '../../core/harvest';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { deriveAccent } from '../../core/harvest';
import { fruitFor, jamTint } from '../forest/flora';
import { hash } from '../forest/tree-layout';
import { CookingPot } from './cooking-pot';
import { EnvasarScene } from './envasar-scene';

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
  imports: [SheetDirective, CookingPot, EnvasarScene],
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

        @if (!pouring()) {
          <div class="pot-zone">
            <app-cooking-pot [fruits]="potFruits()" [tint]="tint()" [stirring]="stirring()" />
            <span class="pot-tag">{{ preserve().name }}</span>
          </div>

          <div class="row-actions">
            <button type="button" class="btn btn-ghost" (click)="closed.emit()">{{ i18n.t().common.cancel }}</button>
            <button type="button" class="btn btn-soft" (click)="stir()">{{ i18n.t().cosecha.stir }}</button>
            <button type="button" class="btn btn-primary make-btn" [disabled]="making()" (click)="make()">
              {{ i18n.t().cosecha.jarIt }}
            </button>
          </div>
        } @else {
          <!-- «El vertido» (0.0.100): the pot pours the blend into the jar;
               when it settles, the seal lands (made). -->
          <app-envasar-scene [preserve]="pourPreview()" (done)="made.emit()" />
          <span class="pot-tag">{{ preserve().name }}</span>
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

    .pot-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      margin-bottom: 1rem;
    }

    .pot-tag {
      font-weight: 700;
      font-size: 0.9rem;
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
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
  /** «El vertido» plays before the seal lands (made emits on scene done). */
  protected readonly pouring = signal(false);

  private readonly members = computed(() =>
    membersOf(this.preserve().id, this.harvests.all()),
  );

  protected readonly tint = computed(() => jamTint(this.members().map((m) => m.accent)));

  /** The jar as it WILL look sealed (real blended tint, not the pending
   *  placeholder) — NOT persisted; the seal itself happens on made. */
  protected readonly pourPreview = computed<Preserve>(() => ({
    ...this.preserve(),
    accent: deriveAccent(this.members()),
    tint: this.tint().tint,
    tintEdge: this.tint().tintEdge,
  }));

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
    setTimeout(() => this.stirring.set(false), 2500);
  }

  protected make(): void {
    if (this.making()) return;
    this.making.set(true);
    // The pour plays first; the seal lands when the scene settles (done).
    this.pouring.set(true);
  }
}
