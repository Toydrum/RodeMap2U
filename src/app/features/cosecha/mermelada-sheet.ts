import { Component, computed, inject, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { ConserveriaService } from '../../core/conserveria.service';
import { Preserve } from '../../core/db/schema';
import { deriveAccent, jarSizeFor } from '../../core/harvest';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { inputValue } from '../../shared/ui/dom';
import { FruitGlyph } from '../forest/fruit';
import { JamJar } from '../forest/jam-jar';
import { fruitFor, jamTint } from '../forest/flora';
import { hash } from '../forest/tree-layout';

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
  imports: [SheetDirective, FruitGlyph, JamJar],
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

            <!-- the pot: picked fruits gather here, drop-in one by one -->
            <div class="pot-zone">
              <svg class="pot" viewBox="0 0 120 74" width="180" height="111" aria-hidden="true">
                <path class="pot-body" d="M 18 22 L 102 22 C 104 46 94 66 60 66 C 26 66 16 46 18 22 Z" />
                <ellipse class="pot-mouth" cx="60" cy="22" rx="42" ry="7" />
                <path class="pot-handle" d="M 14 26 Q 2 28 8 38" />
                <path class="pot-handle" d="M 106 26 Q 118 28 112 38" />
                @for (f of potFruits(); track f.key) {
                  <g class="pot-fruit" [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.rot + ')'">
                    <g appFruit [fruit]="f.spec" [scale]="0.8" />
                  </g>
                }
              </svg>
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
              <button type="button" class="btn btn-primary" [disabled]="!picked().size" (click)="beat.set(2)">
                {{ i18n.t().cosecha.toStove }}
              </button>
            </div>
          }
          @case (2) {
            <h2>{{ i18n.t().cosecha.beat2Title }}</h2>
            <p class="hint">{{ i18n.t().cosecha.beat2Hint }}</p>

            <div class="stove-zone">
              <svg class="pot on-fire" [class.stirring]="stirring()" viewBox="0 0 120 92" width="200" height="153" aria-hidden="true">
                <g class="steam" aria-hidden="true">
                  <path class="wisp w1" d="M 48 14 C 44 8 52 4 48 -2" />
                  <path class="wisp w2" d="M 72 12 C 76 6 68 2 72 -4" />
                </g>
                <path class="pot-body" d="M 18 26 L 102 26 C 104 50 94 70 60 70 C 26 70 16 50 18 26 Z" />
                <ellipse class="jam-surface" cx="60" cy="26" rx="42" ry="7" [attr.fill]="tint().tint" />
                <ellipse class="jam-swirl" cx="60" cy="26" rx="26" ry="4" fill="none" [attr.stroke]="tint().tintEdge" stroke-width="1.4" opacity="0.6" />
                <path class="pot-handle" d="M 14 30 Q 2 32 8 42" />
                <path class="pot-handle" d="M 106 30 Q 118 32 112 42" />
                <g class="flame" aria-hidden="true">
                  <path d="M 52 82 Q 56 74 60 82 Q 64 74 68 82" />
                </g>
              </svg>
              <span class="pot-tag">{{ derivedName() }}</span>
            </div>

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="beat.set(1)">← {{ i18n.t().common.back }}</button>
              <button type="button" class="btn btn-soft" (click)="stir()">{{ i18n.t().cosecha.stir }}</button>
              <button type="button" class="btn btn-primary" (click)="toJar()">{{ i18n.t().cosecha.jarIt }}</button>
            </div>
          }
          @case (3) {
            <h2>{{ i18n.t().cosecha.beat3Title }}</h2>

            <!-- the vessel speaks ONCE, here, past-facing: the jar serves
                 the fruits («el frasco sirve a la fruta») — never a target -->
            <p class="vessel-line">{{ vesselLine() }}</p>

            <div class="new-jar">
              <app-jam-jar class="pour-in" [preserve]="preview()" [size]="1.5" [label]="false" />
            </div>

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
            @if (premio().trim()) {
              <div class="field saved-for-field">
                <label for="jam-saved-for">{{ i18n.t().cosecha.savedForLabel }}</label>
                <input
                  id="jam-saved-for"
                  type="text"
                  maxlength="120"
                  [value]="savedFor()"
                  (input)="savedFor.set(inputValue($event))"
                  [placeholder]="i18n.t().cosecha.savedForPlaceholder"
                />
              </div>
            }

            <div class="row-actions">
              <button type="button" class="btn btn-ghost" (click)="beat.set(2)">← {{ i18n.t().common.back }}</button>
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

    .pot-zone,
    .stove-zone,
    .new-jar {
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

    .pot-mouth {
      fill: color-mix(in srgb, var(--rm-bark) 30%, var(--surface));
      stroke: color-mix(in srgb, var(--text) 35%, transparent);
      stroke-width: 1.2;
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

    /* beat 2 — soft fire + steam; play, never a gate */
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

    .pour-in {
      animation: soft-grow 0.5s ease both;
    }

    @keyframes soft-grow {
      from {
        transform: scale(0.85);
        opacity: 0;
      }
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

    .premio-field,
    .saved-for-field {
      margin-top: 0.7rem;

      label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
    }

    :host-context(.reduce-motion) {
      .pot-fruit,
      .pour-in {
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
export class MermeladaSheet {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly conserveria = inject(ConserveriaService);

  readonly closed = output<void>();
  readonly sealed = output<Preserve>();

  protected readonly beat = signal<1 | 2 | 3>(1);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly jarName = signal('');
  protected readonly premio = signal('');
  protected readonly savedFor = signal('');
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
    setTimeout(() => this.stirring.set(false), 950);
  }

  protected toJar(): void {
    this.jarName.set(this.derivedName());
    this.beat.set(3);
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
        savedFor: this.savedFor(),
      });
      if (jar) this.sealed.emit(jar);
      else this.closed.emit();
    } finally {
      this.sealing.set(false);
    }
  }
}
