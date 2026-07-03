import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { CheckinsRepo } from '../../core/repos/checkins.repo';
import { ToastService } from '../../shared/ui/toast.service';
import { AccentToken, Feeling, Tree } from '../../core/db/schema';
import { hash, taperedRibbon } from './tree-layout';
import { MiniTree } from './mini-tree';
import { SceneBackdrop } from './scene-backdrop';
import { WeatherFront } from './weather-front';
import { FlowerSpec, flowerFor } from './flora';
import { FlowerGlyph } from './flower';

const ACCENTS: AccentToken[] = ['moss', 'sage', 'sky', 'clay', 'lavender', 'sand', 'rose', 'pine'];

interface SceneFlower {
  x: number;
  y: number;
  scale: number;
  spec: FlowerSpec;
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
  imports: [RouterLink, MiniTree, SceneBackdrop, WeatherFront, FlowerGlyph],
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
  /** Tree pending archive (confirm sheet open). */
  protected readonly archiving = signal<Tree | null>(null);
  private readonly toast = inject(ToastService);

  private readonly checkins = inject(CheckinsRepo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    // Check-in's empty-forest exit lands here ready to plant.
    if (this.route.snapshot.queryParamMap.has('plant')) {
      this.creating.set(true);
      const params = { ...this.route.snapshot.queryParams, plant: null };
      void this.router.navigate([], { queryParams: params, replaceUrl: true });
    }
  }

  /** `?mood=` dev/demo override, else the latest check-in's feeling. */
  private readonly moodOverride = new URLSearchParams(location.search).get('mood') as Feeling | null;
  protected readonly mood = computed<Feeling | null>(
    () => this.moodOverride ?? this.checkins.latest()?.feeling ?? null,
  );

  /** The stream flows once the forest has three trees (winding ribbon + ripples). */
  protected readonly hasStream = computed(() => this.trees.active().length >= 3);

  protected readonly streamPath = taperedRibbon(1060, 96, 700, 168, 400, 76, -60, 208, 22, 46);
  protected readonly ripple1 = 'M 1040 104 C 720 170, 430 92, -40 202';
  protected readonly ripple2 = 'M 1045 118 C 735 185, 445 110, -45 218';

  /** One meadow flower per achieved goal — each in ITS tree's species. */
  protected readonly flowers = computed<SceneFlower[]>(() => {
    const achieved = this.nodes.visible().filter((n) => n.status === 'achieved');
    return achieved.slice(0, 26).map((node) => {
      const h = hash(node.id + ':meadow');
      const tree = this.trees.byId().get(node.treeId);
      return {
        x: 30 + (h % 940),
        y: 196 + ((h >> 8) % 52),
        scale: 0.42 + ((h >> 4) % 20) / 100,
        spec: flowerFor(tree?.accent ?? 'rose'),
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

  protected askArchive(event: Event, tree: Tree): void {
    // The button lives inside the plot link — don't navigate.
    event.preventDefault();
    event.stopPropagation();
    this.archiving.set(tree);
  }

  protected async archiveTree(): Promise<void> {
    const tree = this.archiving();
    if (!tree) return;
    await this.trees.archive(tree);
    this.archiving.set(null);
    this.toast.show({
      message: this.i18n.fill(this.i18n.t().tree.archivedToast, { name: tree.name }),
    });
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    await this.trees.create(name, this.newAccent());
    this.newName.set('');
    this.creating.set(false);
  }
}
