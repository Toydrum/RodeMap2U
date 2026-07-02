import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { AccentToken } from '../../core/db/schema';
import { hash } from './tree-layout';

const ACCENTS: AccentToken[] = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];

interface SceneFlower {
  x: number;
  y: number;
  size: number;
  accent: string;
  sway: number;
}

/**
 * The forest home. The scene grows with the user: a stream appears once
 * three trees stand together, and a flower blooms on the meadow for every
 * achieved goal.
 */
@Component({
  selector: 'app-forest',
  imports: [RouterLink],
  templateUrl: './forest.html',
  styleUrl: './forest.scss',
})
export class ForestPage {
  protected readonly i18n = inject(I18nService);
  protected readonly trees = inject(TreesRepo);
  protected readonly nodes = inject(NodesRepo);
  protected readonly accents = ACCENTS;

  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newAccent = signal<AccentToken>('moss');

  /** The stream flows once the forest has three trees. */
  protected readonly hasStream = computed(() => this.trees.active().length >= 3);

  /** One meadow flower per achieved goal (capped so it stays a meadow). */
  protected readonly flowers = computed<SceneFlower[]>(() => {
    const achieved = this.nodes.visible().filter((n) => n.status === 'achieved');
    const palette = ['rose', 'lavender', 'sand', 'sky', 'clay'];
    return achieved.slice(0, 22).map((node) => {
      const h = hash(node.id + ':meadow');
      return {
        x: 30 + (h % 940),
        y: 178 + ((h >> 8) % 62),
        size: 5 + ((h >> 4) % 4),
        accent: palette[h % palette.length],
        sway: -8 + (h % 17),
      };
    });
  });

  protected countFor(treeId: string): number {
    return (this.nodes.byTree().get(treeId) ?? []).length;
  }

  protected bloomsFor(treeId: string): number {
    return (this.nodes.byTree().get(treeId) ?? []).filter((n) => n.status === 'achieved').length;
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    await this.trees.create(name, this.newAccent());
    this.newName.set('');
    this.creating.set(false);
  }
}
