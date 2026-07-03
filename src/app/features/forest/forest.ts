import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { AccentToken } from '../../core/db/schema';
import { hash, taperedRibbon } from './tree-layout';
import { MiniTree } from './mini-tree';
import { SceneBackdrop } from './scene-backdrop';

const ACCENTS: AccentToken[] = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];

interface SceneFlower {
  x: number;
  y: number;
  size: number;
  accent: string;
  sway: number;
}

interface GrassCluster {
  x: number;
  y: number;
  flip: boolean;
}

/**
 * "El Prado" — the forest home as a living scene. Every tree is a real
 * miniature of its data, standing on the meadow; a stream winds through
 * once three trees grow together, and a flower blooms per achieved goal.
 */
@Component({
  selector: 'app-forest',
  imports: [RouterLink, MiniTree, SceneBackdrop],
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

  /** The stream flows once the forest has three trees (winding ribbon + ripples). */
  protected readonly hasStream = computed(() => this.trees.active().length >= 3);

  protected readonly streamPath = taperedRibbon(1060, 96, 700, 168, 400, 76, -60, 208, 22, 46);
  protected readonly ripple1 = 'M 1040 104 C 720 170, 430 92, -40 202';
  protected readonly ripple2 = 'M 1045 118 C 735 185, 445 110, -45 218';

  /** One meadow flower per achieved goal (capped so it stays a meadow). */
  protected readonly flowers = computed<SceneFlower[]>(() => {
    const achieved = this.nodes.visible().filter((n) => n.status === 'achieved');
    const palette = ['rose', 'lavender', 'sand', 'sky', 'clay'];
    return achieved.slice(0, 26).map((node) => {
      const h = hash(node.id + ':meadow');
      return {
        x: 30 + (h % 940),
        y: 196 + ((h >> 8) % 52),
        size: 5 + ((h >> 4) % 4),
        accent: palette[h % palette.length],
        sway: -8 + (h % 17),
      };
    });
  });

  /** Clustered grass (3 blades each), deterministic positions. */
  protected readonly grass: GrassCluster[] = Array.from({ length: 14 }, (_, i) => {
    const h = hash('grass:' + i);
    return { x: 20 + (h % 960), y: 214 + ((h >> 6) % 40), flip: h % 2 === 0 };
  });

  /** Deterministic per-plot vertical offset — rows stop being ruler-straight. */
  protected staggerFor(treeId: string): number {
    return hash(treeId + ':stagger') % 22;
  }

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
