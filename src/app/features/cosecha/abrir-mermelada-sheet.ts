import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { HarvestsRepo } from '../../core/repos/harvests.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { ConserveriaService } from '../../core/conserveria.service';
import { Preserve } from '../../core/db/schema';
import { isElixir, membersOf } from '../../core/harvest';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { HarvestSkyService } from '../../shared/ui/harvest-sky';
import { FruitGlyph } from '../forest/fruit';
import { JamJar } from '../forest/jam-jar';
import { ElixirVial } from '../forest/elixir-vial';
import { fruitFor } from '../forest/flora';

/**
 * «Abrir la mermelada» (0.0.90) — the claiming ceremony. Three beats:
 * A) the breath (doors cancel — «Todavía no» is first-class dignity; no
 * date checks, no earned-ness questions, the intención is NOT shown);
 * B) the claim — openedAt stamps, the petal rain falls in the JAM'S OWN
 * tint (no tarjetita: this sheet IS the card, no escalation by vessel),
 * and the user's premio is spoken back VERBATIM («Te lo ganaste»);
 * C) the savoring — the member memories re-read at the user's pace (té
 * DNA). What is consumed is the REAL-WORLD permission; the jar stays on
 * its shelf «disfrutada» forever. The app never locks a jar. Self-styled.
 */
@Component({
  selector: 'app-abrir-mermelada-sheet',
  imports: [SheetDirective, FruitGlyph, JamJar, ElixirVial],
  template: `
    <div class="sheet-backdrop" (click)="onBackdrop()">
      <div
        class="sheet card abrir-sheet"
        appSheet
        (sheetClose)="onBackdrop()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.fill(i18n.t().cosecha.openConfirmTitle, { name: preserve().name })"
      >
        @if (!claimed()) {
          <h2>{{ title() }}</h2>
          <div class="jar-hero">
            @if (elixir()) {
              <app-elixir-vial [preserve]="preserve()" [size]="1.4" />
            } @else {
              <app-jam-jar [preserve]="preserve()" [size]="1.4" [label]="false" />
            }
          </div>
          @if (elixir()) {
            @if (preserve().carry) {
              <p class="premio-words">🌿 «{{ preserve().carry }}»</p>
            }
          } @else if (preserve().premio) {
            <p class="premio-words">🎀 «{{ preserve().premio }}»</p>
          }
          <p class="hint">{{ i18n.t().cosecha.openConfirmBody }}</p>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost not-yet" (click)="closed.emit()">
              {{ i18n.t().cosecha.notYet }}
            </button>
            <button type="button" class="btn btn-primary open-it" [disabled]="opening()" (click)="claim()">
              {{ elixir() ? i18n.t().cosecha.brindisIt : i18n.t().cosecha.openIt }}
            </button>
          </div>
        } @else {
          <div class="earned">
            <div class="jar-hero">
              @if (elixir()) {
                <app-elixir-vial [preserve]="claimedJar()!" [size]="1.4" />
              } @else {
                <app-jam-jar [preserve]="claimedJar()!" [size]="1.4" [label]="false" />
              }
            </div>
            <p class="earned-headline">{{ headline() }}</p>
            @if (rewardWord()) {
              <p class="earned-premio">«{{ rewardWord() }}»</p>
            }
            <p class="earned-sub">{{ i18n.fill(elixir() ? i18n.t().cosecha.distilledSub : i18n.t().cosecha.earnedSub, { month: monthWord() }) }}</p>
          </div>

          @if (sipRow(); as row) {
            <div class="sip-card">
              <svg viewBox="-14 -15 28 28" width="30" height="30" aria-hidden="true">
                <g appFruit [fruit]="row.spec" [scale]="1" />
              </svg>
              <div class="sip-words">
                <strong>{{ row.title }}</strong>
                <span class="sip-meta">{{ row.treeName }} · {{ row.when }}</span>
                @if (row.note) {
                  <p class="sip-note">«{{ row.note }}»</p>
                }
              </div>
            </div>
          }

          <div class="row-actions">
            @if (sipIndex() < rows().length - 1) {
              <button type="button" class="btn btn-soft next-fruit" (click)="sipIndex.set(sipIndex() + 1)">
                {{ i18n.t().cosecha.nextFruit }}
              </button>
            } @else {
              <button type="button" class="btn btn-primary enjoy-it" (click)="finish()">
                {{ i18n.t().cosecha.enjoyIt }}
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
      margin-bottom: 0.6rem;
      text-align: center;
    }

    .jar-hero {
      display: flex;
      justify-content: center;
      margin-bottom: 0.6rem;
    }

    .premio-words {
      text-align: center;
      font-weight: 700;
      margin-bottom: 0.4rem;
      overflow-wrap: anywhere;
    }

    .hint {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .row-actions {
      display: flex;
      justify-content: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .earned {
      text-align: center;
      margin-bottom: 1rem;

      .earned-headline {
        color: var(--text-dim);
        font-size: 0.95rem;
        margin: 0.4rem 0 0.15rem;
      }

      .earned-premio {
        font-size: 1.35rem;
        font-weight: 800;
        line-height: 1.25;
        overflow-wrap: anywhere;
        animation: earned-in 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both;
      }

      .earned-sub {
        color: var(--text-faint);
        font-size: 0.85rem;
        margin-top: 0.5rem;
      }
    }

    @keyframes earned-in {
      from {
        transform: translateY(8px) scale(0.94);
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
      .earned-premio,
      .sip-card {
        animation: none;
      }
    }
  `,
})
export class AbrirMermeladaSheet {
  protected readonly i18n = inject(I18nService);
  private readonly harvests = inject(HarvestsRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly conserveria = inject(ConserveriaService);
  private readonly sky = inject(HarvestSkyService);

  readonly preserve = input.required<Preserve>();
  readonly monthWord = input('');
  readonly closed = output<void>();
  readonly opened = output<Preserve>();

  protected readonly claimed = signal(false);
  protected readonly claimedJar = signal<Preserve | null>(null);
  protected readonly sipIndex = signal(0);
  protected readonly opening = signal(false);

  /** «La despedida» (0.0.95): the same ceremony serves a jam (savor its
   *  members) and an elixir (a brindis — savor the whole tree's fruits). */
  protected readonly elixir = computed(() => isElixir(this.preserve()));

  protected title(): string {
    const key = this.elixir() ? this.i18n.t().cosecha.brindisTitle : this.i18n.t().cosecha.openConfirmTitle;
    return this.i18n.fill(key, { name: this.preserve().name });
  }

  /** «Esto te lo llevas:» (elixir) · «Te lo ganaste:» (premio jam) · «Para
   *  saborear:» (memory jar, no premio — never an empty reward). */
  protected headline(): string {
    const t = this.i18n.t().cosecha;
    if (this.elixir()) return t.carryHeadline;
    return this.preserve().premio ? t.earnedHeadline : t.savorHeadline;
  }

  /** The verbatim words spoken back — carry (elixir) or premio (jam); empty
   *  for a memory jar (the @if hides the line). */
  protected rewardWord(): string {
    return (this.elixir() ? this.preserve().carry : this.preserve().premio) ?? '';
  }

  protected readonly rows = computed(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const p = this.preserve();
    const source = this.elixir()
      ? this.harvests
          .all()
          .filter((h) => h.treeId === p.treeId)
          .sort((a, b) => b.harvestedAt - a.harvestedAt || (a.id < b.id ? -1 : 1))
      : membersOf(p.id, this.harvests.all());
    return source.map((harvest) => ({
      title: harvest.title,
      treeName: harvest.treeName,
      spec: fruitFor(harvest.accent, harvest.treeId),
      when: new Date(harvest.harvestedAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      }),
      note: this.nodes.byId().get(harvest.nodeId)?.note?.trim() ?? '',
    }));
  });

  protected readonly sipRow = computed(() => this.rows()[this.sipIndex()] ?? null);

  /** Before the claim, dismissing is a pure no-op (doors cancel). After,
   *  the claim already stands — closing just ends the savoring. */
  protected onBackdrop(): void {
    if (this.claimed()) {
      this.finish();
    } else {
      this.closed.emit();
    }
  }

  protected async claim(): Promise<void> {
    if (this.opening()) return;
    this.opening.set(true);
    try {
      const jar = await this.conserveria.open(this.preserve());
      if (!jar) {
        this.closed.emit();
        return;
      }
      this.claimedJar.set(jar);
      this.claimed.set(true);
      this.sipIndex.set(0);
      // the rain in the jam's own tint — the sheet itself is the card
      this.sky.rainTint(jar.tint, jar.tintEdge);
    } finally {
      this.opening.set(false);
    }
  }

  protected finish(): void {
    const jar = this.claimedJar();
    if (jar) this.opened.emit(jar);
    this.closed.emit();
  }
}
