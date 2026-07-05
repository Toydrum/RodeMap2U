import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { Tree, TreeNode } from '../../core/db/schema';

interface OutlineRow {
  node: TreeNode;
  depth: number;
  /** 1-based position when the parent's pasitos are an ordered path. */
  index: number | null;
}

/**
 * The little table of branches ("tablita"): an indented outline of the whole
 * tree, floating beside the canvas. One tap LOCATES a branch on the map
 * (focus + pan — browsing never opens sheets); tapping the same row again
 * opens its sheet. Mirrors the tree exactly: childrenOf, order ascending.
 */
@Component({
  selector: 'app-tree-outline',
  template: `
    <div class="head">
      <h2>{{ i18n.t().tree.outlineTitle }}</h2>
      <button
        type="button"
        class="btn btn-ghost close"
        (click)="closed.emit()"
        [attr.aria-label]="i18n.t().common.close"
      >✕</button>
    </div>
    <p class="outline-hint">{{ i18n.t().tree.outlineHint }}</p>
    <ul>
      @for (row of rows(); track row.node.id) {
        <li>
          <button
            type="button"
            class="row"
            [class.active]="focusedId() === row.node.id"
            [style.padding-left.px]="8 + row.depth * 14"
            (click)="onRow(row)"
          >
            <span class="status-dot" [class]="'status-dot ' + row.node.status"></span>
            @if (row.index !== null) {
              <span class="idx">{{ row.index }}.</span>
            }
            <span class="name" [class.done]="row.node.status === 'achieved'">{{ row.node.title }}</span>
            @if (tree().currentNodeId === row.node.id) {
              <span class="pin" aria-hidden="true">📍</span>
            }
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;

      h2 {
        font-size: 0.95rem;
        margin: 0;
      }

      .close {
        min-height: 36px;
        min-width: 36px;
        padding: 0.2rem;
      }
    }

    .outline-hint {
      margin: 0.1rem 0 0.5rem;
      font-size: 0.76rem;
      color: var(--text-faint);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      min-height: 0;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      width: 100%;
      border: none;
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 0.88rem;
      text-align: left;
      padding: 0.42rem 0.5rem;
      border-radius: 8px;
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }

      &.active {
        background: color-mix(in srgb, var(--primary) 13%, transparent);
        font-weight: 700;
      }

      .idx {
        color: var(--text-faint);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.done {
          color: var(--text-faint);
          text-decoration: line-through;
          text-decoration-color: var(--status-achieved);
        }
      }

      .pin {
        font-size: 0.8rem;
      }
    }
  `,
})
export class TreeOutline {
  readonly tree = input.required<Tree>();
  readonly focusedId = input<string | null>(null);
  readonly locate = output<TreeNode>();
  readonly open = output<TreeNode>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly nodes = inject(NodesRepo);
  private readonly lastTap = signal<string | null>(null);

  protected readonly rows = computed<OutlineRow[]>(() => {
    const out: OutlineRow[] = [];
    const walk = (node: TreeNode, depth: number, index: number | null) => {
      out.push({ node, depth, index });
      const ordered = node.flow === 'steps';
      this.nodes.childrenOf(node).forEach((child, i) => {
        walk(child, depth + 1, ordered ? i + 1 : null);
      });
    };
    for (const root of this.nodes.rootsOf(this.tree().id)) walk(root, 0, null);
    return out;
  });

  /** First tap locates; a second tap on the same row opens its sheet. */
  protected onRow(row: OutlineRow): void {
    if (this.lastTap() === row.node.id) {
      this.open.emit(row.node);
    } else {
      this.lastTap.set(row.node.id);
      this.locate.emit(row.node);
    }
  }
}
