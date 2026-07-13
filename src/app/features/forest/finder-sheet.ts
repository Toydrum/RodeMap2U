import { Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { inputValue } from '../../shared/ui/dom';
import { FinderHit, findMatches } from './finder';

/**
 * «Buscar una rama» — the utilitarian finder sheet (the wind rose stays the
 * poetic door; this one just FINDS). Matching lives in the pure finder.ts;
 * this component is only the sheet around it. Tap a tree hit → open it;
 * tap a branch hit → open its tree LOCATING the branch (?locate= pans the
 * canvas without opening any sheet). Styles are self-contained (the
 * ConfirmSheet lesson).
 */
@Component({
  selector: 'app-finder-sheet',
  imports: [SheetDirective],
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet card finder"
        appSheet
        (sheetClose)="closed.emit()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().finder.title"
      >
        <h2>🔍 {{ i18n.t().finder.title }}</h2>
        <div class="field">
          <input
            id="finder-q"
            type="text"
            autofocus
            [value]="query()"
            (input)="query.set(inputValue($event))"
            [placeholder]="i18n.t().finder.placeholder"
            maxlength="60"
            [attr.aria-label]="i18n.t().finder.title"
          >
        </div>
        @if (hits().length) {
          <ul class="finder-hits">
            @for (hit of hits(); track hit.treeId + (hit.nodeId ?? '')) {
              <li>
                <button type="button" class="finder-hit" (click)="goHit(hit)">
                  <span class="hit-title">{{ hit.nodeId ? '🌿' : '🌳' }} {{ hit.title }}</span>
                  @if (hit.nodeId) {
                    <span class="hit-tree">{{ hit.treeName }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        } @else if (query().trim().length >= 2) {
          <p class="hint">{{ i18n.t().finder.empty }}</p>
        } @else {
          <p class="hint">{{ i18n.t().finder.hint }}</p>
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

    .field input {
      width: 100%;
    }

    .finder-hits {
      list-style: none;
      margin: 0.4rem 0 0;
      padding: 0;
      max-height: 46vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .finder-hit {
      width: 100%;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.6rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      cursor: pointer;
      text-align: left;

      &:hover {
        background: var(--surface-2);
      }

      .hit-title {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .hit-tree {
        flex-shrink: 0;
        font-size: 0.78rem;
        color: var(--text-dim);
      }
    }
  `,
})
export class FinderSheet {
  protected readonly i18n = inject(I18nService);
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly router = inject(Router);
  protected readonly inputValue = inputValue;

  protected readonly query = signal('');
  readonly closed = output<void>();

  protected readonly hits = computed<FinderHit[]>(() =>
    findMatches(this.query(), this.trees.active(), (treeId) =>
      this.nodes.byTree().get(treeId) ?? [],
    ),
  );

  protected goHit(hit: FinderHit): void {
    this.closed.emit();
    void this.router.navigate(
      ['/tree', hit.treeId],
      hit.nodeId ? { queryParams: { locate: hit.nodeId } } : {},
    );
  }
}
