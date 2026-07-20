import { Component, input } from '@angular/core';

/**
 * «El duramen» (0.0.113) — THE heart-of-the-tree symbol (owner pick over a
 * stock emoji: 🌳 already means forest/tree, the emoji law's exact
 * collision). A trunk's cross-section: three ECCENTRIC growth rings (real
 * heartwood grows off-center — perfect concentricity reads as a target,
 * not wood) around a warm core, plus one radial hairline crack. Drawn in
 * the app's hand-made language like the spiral and the flowers; tinted by
 * the tree's own accent, deepened toward the theme text so pale accents
 * stay legible at chip size. Base ≈ 12px radius at scale 1 (the FlowerGlyph
 * convention). Still by design — the heart doesn't spin.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'g[appHeartwood]',
  template: `
    <svg:g [attr.transform]="'scale(' + scale() + ')'">
      <svg:circle class="ring outer" r="8.6" [style.stroke]="deepTint()" />
      <svg:circle class="ring mid" cx="0.5" cy="0.35" r="5.4" [style.stroke]="deepTint()" />
      <svg:circle class="ring inner" cx="1" cy="0.7" r="2.6" [style.stroke]="deepTint()" />
      <svg:circle class="core" cx="1.2" cy="0.85" r="1.05" [style.fill]="deepTint()" />
      <!-- la grieta: one radial hairline — what makes it read as WOOD -->
      <svg:path class="crack" d="M 3.4 -2.1 L 7.6 -4.6" [style.stroke]="deepTint()" />
    </svg:g>
  `,
  styles: `
    .ring {
      fill: none;
      stroke-width: 1.15;
      stroke-linecap: round;
    }

    .ring.outer {
      opacity: 0.55;
    }

    .ring.mid {
      opacity: 0.75;
    }

    .ring.inner {
      opacity: 0.95;
    }

    .core {
      opacity: 0.95;
    }

    .crack {
      fill: none;
      stroke-width: 0.8;
      stroke-linecap: round;
      opacity: 0.45;
    }
  `,
})
export class HeartwoodGlyph {
  /** The tree's own accent (a CSS var or hex) — bark-warm by default. */
  readonly tint = input('#8a6f52');
  readonly scale = input(1);

  /** Lean toward the theme's text so pale accents stay legible tiny. */
  protected deepTint(): string {
    return `color-mix(in srgb, ${this.tint()} 62%, var(--text))`;
  }
}
