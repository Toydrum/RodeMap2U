import { Component, computed, inject, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { ConserveriaService } from '../../core/conserveria.service';
import { Preserve } from '../../core/db/schema';
import { deriveAccent, jarSizeFor } from '../../core/harvest';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { inputValue } from '../../shared/ui/dom';
import { FruitGlyph } from '../forest/fruit';
import { fruitFor, jamTint } from '../forest/flora';
import { hash } from '../forest/tree-layout';
import { CookingPot } from './cooking-pot';
import { EnvasarScene } from './envasar-scene';

/**
 * «Hacer mermelada» (0.0.89) — the three-beat sealing ritual. DOORS CANCEL:
 * dismissing at ANY beat is a pure no-op — no data moves until the final
 * commit, so a mid-ritual reload loses nothing. The pot has NO minimum
 * («con una alcanza»), NO cap, NO counter, NO select-all — handling each
 * fruit one-by-one is the point (every pick is a re-read of a memory).
 * The flavor is never chosen from a menu: the label derives from the
 * hands — one species names itself, a mix becomes «mermelada del bosque»
 * (first-class). Stirring is play, never a gate: «Envasar» is enabled
 * from the first frame of the stove. Styles self-contained (sheet law).
 */
@Component({
  selector: 'app-mermelada-sheet',
  imports: [SheetDirective, FruitGlyph, CookingPot, EnvasarScene],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card jam-sheet"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().cosecha.makeJam"
      >
        @switch (beat()) {
          @case (1) {
            <h2>{{ i18n.t().cosecha.beat1Title }}</h2>
            <p class="hint">{{ i18n.t().cosecha.beat1Hint }}</p>

            <!-- the pot simmers on the fire while you pick, one by one: the
                 fruits gather AND cook here (0.0.94 — the old separate stove
                 beat was a mandatory step that decided nothing). -->
            <div class="pot-zone">
              <app-cooking-pot [fruits]="potFruits()" [tint]="tint()" [stirring]="stirring()" />
              <span class="pot-tag" [class.quiet]="!picked().size">
                {{ picked().size ? derivedName() : i18n.t().cosecha.potEmpty }}
              </span>
            </div>

            <ul class="tray">
              @for (row of tray(); track row.harvest.id) {
                <li>
                  <button
                    type="button"
                    class="fruit-pick"
                    [class.picked]="picked().has(row.harvest.id)"
                    [attr.aria-pressed]="picked().has(row.harvest.id)"
                    (click)="toggle(row.harvest.id)"
                  >
                    <svg viewBox="-14 -15 28 28" width="26" height="26" aria-hidden="true">
                      <g appFruit [fruit]="row.spec" [scale]="0.9" />
                    </svg>
                    <span class="pick-title">{{ row.harvest.title }}</span>
                  </button>
                </li>
              }
            </ul>

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="closed.emit()">
                {{ i18n.t().common.cancel }}
              </button>
              <button type="button" class="btn btn-soft" [disabled]="!picked().size" (click)="stir()">
                {{ i18n.t().cosecha.stir }}
              </button>
              <button type="button" class="btn btn-primary" [disabled]="!picked().size" (click)="toJar()">
                {{ i18n.t().cosecha.jarIt }}
              </button>
            </div>
          }
          @case (2) {
            <h2>{{ i18n.t().cosecha.beat3Title }}</h2>

            <!-- the vessel speaks ONCE, here, past-facing: the jar serves
                 the fruits («el frasco sirve a la fruta») — never a target -->
            <p class="vessel-line">{{ vesselLine() }}</p>

            <!-- «El vertido» (0.0.100): the pot pours the batch's own tint
                 into the jar. Decorative — every field/button stays live. -->
            <app-envasar-scene [preserve]="preview()" />

            <div class="field">
              <input
                id="jam-name"
                type="text"
                maxlength="60"
                [value]="jarName()"
                (input)="jarName.set(inputValue($event))"
                [attr.aria-label]="i18n.t().cosecha.beat3Title"
              />
            </div>

            <!-- «el premio del frasco»: optional, quiet — the absence is
                 never named; the app never suggests or values rewards -->
            <div class="field premio-field">
              <label for="jam-premio">{{ i18n.t().cosecha.premioLabel }}</label>
              <input
                id="jam-premio"
                type="text"
                maxlength="120"
                [value]="premio()"
                (input)="premio.set(inputValue($event))"
                [placeholder]="i18n.t().cosecha.premioPlaceholder"
              />
            </div>
<div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="beat.set(1)">← {{ i18n.t().common.back }}</button>
              <button type="button" class="btn btn-primary seal-btn" [disabled]="sealing()" (click)="seal()">
                {{ i18n.t().cosecha.saveShelf }}
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

      &.quiet {
        color: var(--text-faint);
        font-weight: 500;
      }
    }

    .tray {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.5rem;
      max-height: 34vh;
      overflow-y: auto;
    }

    .fruit-pick {
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

    .field input {
      width: 100%;
    }

    .vessel-line {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.92rem;
      margin-bottom: 0.5rem;
    }

    .premio-field {
      margin-top: 0.7rem;

      label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
    }

  `,
})
export class MermeladaSheet {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly conserveria = inject(ConserveriaService);

  readonly closed = output<void>();
  readonly sealed = output<Preserve>();

  protected readonly beat = signal<1 | 2>(1);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly jarName = signal('');
  protected readonly premio = signal('');
  protected readonly sealing = signal(false);
  protected readonly stirring = signal(false);

  /** LIVE fresh fruits — the tray shrinks honestly if a fruit seals
   *  elsewhere mid-ritual (cross-tab); commit re-validates anyway. */
  protected readonly tray = computed(() =>
    this.harvests.fresh().map((harvest) => ({
      harvest,
      spec: fruitFor(harvest.accent, harvest.treeId),
    })),
  );

  protected readonly pickedFruits = computed(() =>
    this.tray().filter((row) => this.picked().has(row.harvest.id)),
  );

  /** The flavor derives from the hands — never a menu. */
  protected readonly derivedName = computed(() => {
    const members = this.pickedFruits().map((r) => r.harvest);
    if (!members.length) return '';
    const accent = deriveAccent(members);
    return accent
      ? this.i18n.t().cosecha.jamNames[fruitFor(accent).shape]
      : this.i18n.t().cosecha.jamForest;
  });

  protected readonly tint = computed(() =>
    jamTint(this.pickedFruits().map((r) => r.harvest.accent)),
  );

  /** Pot cluster — id-stable scatter over the pot's belly. */
  protected readonly potFruits = computed(() =>
    this.pickedFruits().map((row) => ({
      key: row.harvest.id,
      x: 34 + (hash(row.harvest.id + ':px') % 53),
      y: 34 + (hash(row.harvest.id + ':py') % 22),
      rot: -18 + (hash(row.harvest.id + ':pr') % 37),
      spec: row.spec,
    })),
  );

  /** Preview jar for beat 3 — NOT persisted (doors cancel clean). */
  protected readonly preview = computed<Preserve>(() => {
    const members = this.pickedFruits().map((r) => r.harvest);
    const t = this.tint();
    return {
      id: 'preview',
      createdAt: 0,
      updatedAt: 0,
      rev: 1,
      deletedAt: null,
      kind: 'mermelada',
      name: this.jarName() || this.derivedName(),
      madeAt: 0,
      accent: deriveAccent(members),
      tint: t.tint,
      tintEdge: t.tintEdge,
      size: jarSizeFor(members.length),
      premio: this.premio().trim() || null,
      openedAt: null,
    };
  });

  /** The vessel line — spoken once, past-facing («tus N frutas piden…»). */
  protected readonly vesselLine = computed(() => {
    const n = this.pickedFruits().length;
    const dict = this.i18n.t().cosecha.vesselLine;
    const size = jarSizeFor(n);
    if (size === 'frasquito') return this.i18n.plural(n, dict.frasquito);
    return this.i18n.fill(size === 'frasco' ? dict.frasco : dict.frascote, { count: n });
  });

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.picked.set(next);
  }

  protected stir(): void {
    this.stirring.set(false);
    requestAnimationFrame(() => this.stirring.set(true));
    setTimeout(() => this.stirring.set(false), 2500);
  }

  protected toJar(): void {
    this.jarName.set(this.derivedName());
    this.beat.set(2);
  }

  protected async seal(): Promise<void> {
    if (this.sealing()) return;
    this.sealing.set(true);
    try {
      const t = this.tint();
      const jar = await this.conserveria.seal([...this.picked()], {
        name: this.jarName().trim() || this.derivedName(),
        tint: t.tint,
        tintEdge: t.tintEdge,
        premio: this.premio(),
      });
      if (jar) this.sealed.emit(jar);
      else this.closed.emit();
    } finally {
      this.sealing.set(false);
    }
  }
}
