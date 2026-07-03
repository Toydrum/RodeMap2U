import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { ToastService } from '../../shared/ui/toast.service';
import { CheckIn, Feeling, TreeNode } from '../../core/db/schema';

const FEELING_EMOJI: Record<Feeling, string> = {
  sunny: '☀️',
  calm: '🌤',
  foggy: '🌫',
  heavy: '🌧',
  stormy: '⛈',
};

interface Footprint {
  checkIn: CheckIn;
  emoji: string;
  feelingName: string;
  when: string;
  place: string | null;
  note: string;
}

interface BranchNote {
  node: TreeNode;
  treeName: string;
  when: string;
  note: string;
}

/** "Tus huellas" — the quiet trail of past check-ins. Just for looking. */
@Component({
  selector: 'app-trail',
  templateUrl: './trail.html',
  styleUrl: './trail.scss',
})
export class TrailPage {
  protected readonly i18n = inject(I18nService);
  private readonly checkins = inject(CheckinsRepo);
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Card asking "let it go?" right now — checkIn id or node id, one at a time. */
  protected readonly confirming = signal<string | null>(null);

  protected readonly footprints = computed<Footprint[]>(() => {
    const dict = this.i18n.t();
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    return [...this.checkins.all()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => {
        const tree = c.treeId ? this.trees.byId().get(c.treeId) : undefined;
        const node = c.nodeId ? this.nodes.byId().get(c.nodeId) : undefined;
        const place = tree ? (node ? `${tree.name} · ${node.title}` : tree.name) : null;
        const at = new Date(c.createdAt);
        const when =
          at.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) +
          ' · ' +
          at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        return {
          checkIn: c,
          emoji: FEELING_EMOJI[c.feeling],
          feelingName: dict.checkIn.feelings[c.feeling],
          when,
          place,
          note: c.note.trim(),
        };
      });
  });

  /** Every written word still hanging on a branch, freshest first. */
  protected readonly branchNotes = computed<BranchNote[]>(() => {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    const out: BranchNote[] = [];
    for (const tree of this.trees.active()) {
      for (const node of this.nodes.byTree().get(tree.id) ?? []) {
        const note = node.note.trim();
        if (!note) continue;
        out.push({
          node,
          treeName: tree.name,
          note,
          when: new Date(node.updatedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        });
      }
    }
    return out.sort((a, b) => b.node.updatedAt - a.node.updatedAt);
  });

  /** Reread in place: open the branch right on its tree. */
  protected openBranch(entry: BranchNote): void {
    void this.router.navigate(['/tree', entry.node.treeId], {
      queryParams: { node: entry.node.id },
    });
  }

  /** Let a footprint go — a soft tombstone, never a physical erase. */
  protected async letGoCheckin(fp: Footprint): Promise<void> {
    await this.checkins.tombstone(fp.checkIn);
    this.confirming.set(null);
    this.toast.show({ message: this.i18n.t().trail.goneCheckin });
  }

  /** Release a little note: it leaves the trail AND its branch's paper leaf. */
  protected async releaseNote(entry: BranchNote): Promise<void> {
    await this.nodes.update(entry.node, { note: '' });
    this.confirming.set(null);
    this.toast.show({ message: this.i18n.t().trail.goneNote });
  }

  protected goBack(): void {
    if (history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/settings']);
    }
  }
}
