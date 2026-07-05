import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { Tree, TreeNode } from '../../core/db/schema';

interface OutlineRow {
  node: TreeNode;
  depth: number;
  /** 1-based position when the parent's pasitos are an ordered path. */
  index: number | null;
  hasKids: boolean;
  isCollapsed: boolean;
  /** Descendants sleeping inside a collapsed row — the little (N) chip. */
  hiddenCount: number;
}

/** Trees larger than this open with their sub-branches folded. */
const AUTO_COLLAPSE_AT = 12;

/**
 * The little table of branches ("tablita"): an indented outline of the whole
 * tree, floating beside the canvas. One tap LOCATES a branch on the map
 * (focus + pan — browsing never opens sheets); tapping the same row again
 * opens its sheet. Rows with children carry a ▸/▾ triangle; big trees open
 * with depth-1 parents collapsed so the list never greets you long.
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
        <li class="line" [style.padding-left.px]="4 + row.depth * 14">
          @if (row.hasKids) {
            <button
              type="button"
              class="tri"
              (click)="toggle(row.node)"
              [attr.aria-expanded]="!row.isCollapsed"
              [attr.aria-label]="i18n.fill(
                row.isCollapsed ? i18n.t().tree.outlineExpand : i18n.t().tree.outlineCollapse,
                { title: row.node.title }
              )"
            >{{ row.isCollapsed ? '▸' : '▾' }}</button>
          } @else {
            <span class="tri spacer" aria-hidden="true">•</span>
          }
          <button
            type="button"
            class="row"
            [class.active]="focusedId() === row.node.id"
            (click)="onRow(row)"
          >
            <span class="status-dot" [class]="'status-dot ' + row.node.status"></span>
            @if (row.index !== null) {
              <span class="idx">{{ row.index }}.</span>
            }
            <span class="name" [class.done]="row.node.status === 'achieved'">{{ row.node.title }}</span>
            @if (row.isCollapsed && row.hiddenCount) {
              <span class="hidden-count">({{ row.hiddenCount }})</span>
            }
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

    .line {
      display: flex;
      align-items: center;
    }

    .tri {
      flex: none;
      width: 24px;
      min-height: 34px;
      border: none;
      background: none;
      color: var(--text-faint);
      font-size: 0.72rem;
      cursor: pointer;
      border-radius: 6px;

      &:hover:not(.spacer) {
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--text);
      }

      &.spacer {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.45;
        cursor: default;
      }
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 0.88rem;
      text-align: left;
      padding: 0.42rem 0.5rem 0.42rem 0.2rem;
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

      .hidden-count {
        color: var(--text-faint);
        font-size: 0.74rem;
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

  /** Folded rows. Session-scoped on purpose — the tablita is a lens, not state. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  private seededFor: string | null = null;

  constructor() {
    // Big trees open folded to their main branches — once per tree visit.
    effect(() => {
      const treeId = this.tree().id;
      if (this.seededFor === treeId) return;
      this.seededFor = treeId;
      untracked(() => {
        const seed = new Set<string>();
        const total = (this.nodes.byTree().get(treeId) ?? []).length;
        if (total > AUTO_COLLAPSE_AT) {
          for (const root of this.nodes.rootsOf(treeId)) {
            for (const child of this.nodes.childrenOf(root)) {
              if (this.nodes.childrenOf(child).length) seed.add(child.id);
            }
          }
        }
        this.collapsed.set(seed);
      });
    });
  }

  protected readonly rows = computed<OutlineRow[]>(() => {
    const folded = this.collapsed();
    const out: OutlineRow[] = [];
    const countDesc = (node: TreeNode): number => {
      let count = 0;
      const queue = [...this.nodes.childrenOf(node)];
      while (queue.length) {
        const n = queue.pop()!;
        count++;
        queue.push(...this.nodes.childrenOf(n));
      }
      return count;
    };
    const walk = (node: TreeNode, depth: number, index: number | null) => {
      const kids = this.nodes.childrenOf(node);
      const isCollapsed = folded.has(node.id) && kids.length > 0;
      out.push({
        node,
        depth,
        index,
        hasKids: kids.length > 0,
        isCollapsed,
        hiddenCount: isCollapsed ? countDesc(node) : 0,
      });
      if (isCollapsed) return;
      const ordered = node.flow === 'steps';
      kids.forEach((child, i) => walk(child, depth + 1, ordered ? i + 1 : null));
    };
    for (const root of this.nodes.rootsOf(this.tree().id)) walk(root, 0, null);
    return out;
  });

  protected toggle(node: TreeNode): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

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
