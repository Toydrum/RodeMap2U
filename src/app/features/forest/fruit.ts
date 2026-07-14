import { Component, input } from '@angular/core';
import { FruitSpec } from './flora';

/**
 * A fruit, drawn per species — used inside any SVG as <g appFruit ...>.
 * Sister of FlowerGlyph: body within r≈7–9 at scale 1, stem rising to
 * y≈−12. Flowers are radial/petaled; fruits are convex blobs or clusters
 * with a hanging stem and a single shine — kin by stroke DNA, distinct by
 * silhouette. Stems/leaves ride the global theme greens (--rm-bark /
 * --rm-twig, both themes define them since 0.0.82).
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'g[appFruit]',
  styles: `
    .fruit-stem {
      stroke: var(--rm-bark);
      fill: none;
      stroke-linecap: round;
    }
    .fruit-leaf {
      fill: var(--rm-twig);
    }
    .fruit-shine {
      fill: #ffffff;
      opacity: 0.45;
    }
  `,
  template: `
    <svg:g [attr.transform]="'scale(' + scale() + ')'">
      @switch (fruit().shape) {
        @case ('pera') {
          <svg:path class="fruit-stem" d="M 0 -7.5 C 0.4 -9.5 0.2 -10.8 0.9 -12" stroke-width="1.1" />
          <svg:path class="fruit-leaf" d="M 0.9 -10.2 Q 5 -12.4 7.4 -8.8 Q 3.6 -7 0.9 -10.2 Z" />
          <svg:path
            d="M 0 -8 C 2.2 -8 3 -6 3.2 -3.6 C 3.6 -0.6 6 0.6 6 3.4 C 6 6.8 3.4 8.8 0 8.8 C -3.4 8.8 -6 6.8 -6 3.4 C -6 0.6 -3.6 -0.6 -3.2 -3.6 C -3 -6 -2.2 -8 0 -8 Z"
            [attr.fill]="fruit().skin"
            [attr.stroke]="fruit().skinEdge"
            stroke-width="0.7"
          />
          <svg:ellipse cx="-2" cy="-2.6" rx="1.6" ry="2.4" [attr.fill]="fruit().blush" opacity="0.5" />
          @for (dot of [{ x: 1.6, y: 3.2 }, { x: -1.2, y: 5.4 }, { x: 3.2, y: 5.8 }]; track dot.x) {
            <svg:circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="0.45" [attr.fill]="fruit().skinEdge" opacity="0.5" />
          }
          <svg:ellipse class="fruit-shine" cx="-2.4" cy="2.6" rx="1.8" ry="1.1" />
        }
        @case ('arandanos') {
          <svg:path class="fruit-stem" d="M 0.6 -7.2 C 0.8 -9 0.5 -10.6 1.2 -12" stroke-width="1" />
          @for (
            berry of [
              { x: 3.8, y: 2.6, r: 3.6 },
              { x: -3.6, y: 1.8, r: 4.0 },
              { x: 0.6, y: -3, r: 4.6 }
            ];
            track berry.x
          ) {
            <svg:circle
              [attr.cx]="berry.x" [attr.cy]="berry.y" [attr.r]="berry.r"
              [attr.fill]="fruit().skin"
              [attr.stroke]="fruit().skinEdge"
              stroke-width="0.6"
            />
            <svg:ellipse
              [attr.cx]="berry.x - 1.2" [attr.cy]="berry.y - 1.4"
              rx="1.4" ry="0.9"
              [attr.fill]="fruit().blush" opacity="0.55"
            />
          }
          @for (angle of [-40, 25, 80]; track angle) {
            <svg:line
              x1="0.6" y1="-7.2" x2="0.6" y2="-5.8"
              [attr.transform]="'rotate(' + angle + ' 0.6 -6.5)'"
              [attr.stroke]="fruit().skinEdge" stroke-width="0.6"
            />
          }
        }
        @case ('naranja') {
          <svg:path class="fruit-stem" d="M 0 -6.8 C 0.4 -8.8 0.2 -10.4 0.9 -12" stroke-width="1.1" />
          <svg:path class="fruit-leaf" d="M 0.9 -9.8 Q 6 -13 9 -8.4 Q 4.4 -6.2 0.9 -9.8 Z" />
          <svg:circle r="7.2" [attr.fill]="fruit().skin" [attr.stroke]="fruit().skinEdge" stroke-width="0.7" />
          <svg:circle cy="5.6" r="0.8" [attr.fill]="fruit().skinEdge" opacity="0.5" />
          @for (dot of [{ x: -3, y: -1 }, { x: 2.4, y: 1.8 }, { x: -0.8, y: 3.6 }]; track dot.x) {
            <svg:circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="0.4" [attr.fill]="fruit().skinEdge" opacity="0.35" />
          }
          <svg:ellipse class="fruit-shine" cx="-2.6" cy="-2.8" rx="2" ry="1.2" />
        }
        @case ('uvas') {
          <svg:path class="fruit-stem" d="M 0 -7.4 C 0.3 -9.2 0.1 -10.6 0.8 -12" stroke-width="1" />
          <svg:path class="fruit-stem" d="M 0 -7.4 C -1.4 -8.6 -2.2 -9.6 -2.6 -10.8" stroke-width="0.8" />
          <svg:path class="fruit-leaf" d="M 0.8 -10.4 Q 4.8 -12.6 7 -9 Q 3.4 -7.4 0.8 -10.4 Z" />
          @for (
            grape of [
              { x: 0, y: -4.6 },
              { x: -3, y: -0.8 },
              { x: 3, y: -0.8 },
              { x: -1.6, y: 3 },
              { x: 1.6, y: 3 },
              { x: 0, y: 6.6 }
            ];
            track grape.x + ':' + grape.y
          ) {
            <svg:circle
              [attr.cx]="grape.x" [attr.cy]="grape.y" r="2.7"
              [attr.fill]="fruit().skin"
              [attr.stroke]="fruit().skinEdge"
              stroke-width="0.55"
            />
          }
          <svg:ellipse [attr.fill]="fruit().blush" cx="-0.9" cy="-5.4" rx="1.1" ry="0.7" opacity="0.6" />
          <svg:ellipse class="fruit-shine" cx="-3.8" cy="-1.6" rx="1" ry="0.7" />
        }
        @case ('durazno') {
          <svg:path class="fruit-stem" d="M 0 -6.6 C 0.4 -8.6 0.2 -10.4 0.9 -12" stroke-width="1.1" />
          <svg:path class="fruit-leaf" d="M 0.9 -9.9 Q 5.4 -12.2 7.8 -8.6 Q 4 -6.8 0.9 -9.9 Z" />
          <svg:circle r="7" [attr.fill]="fruit().skin" [attr.stroke]="fruit().skinEdge" stroke-width="0.7" />
          <svg:path
            d="M 0 -7 C -2.6 -3 -2.6 3 0 7"
            fill="none"
            [attr.stroke]="fruit().skinEdge"
            stroke-width="0.7"
            opacity="0.5"
          />
          <svg:ellipse cx="3" cy="-1" rx="3" ry="4" [attr.fill]="fruit().blush" opacity="0.5" />
          <svg:ellipse class="fruit-shine" cx="-2.8" cy="-2.6" rx="1.9" ry="1.2" />
        }
        @case ('cerezas') {
          <svg:path class="fruit-stem" d="M -3.8 -0.4 C -3 -4 -1.5 -7.5 0.8 -10" stroke-width="1" />
          <svg:path class="fruit-stem" d="M 4 1.4 C 4 -3 2.6 -7 0.8 -10" stroke-width="1" />
          <svg:path class="fruit-stem" d="M 0.8 -10 C 0.9 -10.8 1 -11.4 1.2 -12" stroke-width="1.1" />
          <svg:path class="fruit-leaf" d="M 1.2 -10.6 Q 5.2 -12.8 7.6 -9.2 Q 3.8 -7.6 1.2 -10.6 Z" />
          <svg:circle cx="-3.8" cy="3.2" r="3.7" [attr.fill]="fruit().skin" [attr.stroke]="fruit().skinEdge" stroke-width="0.65" />
          <svg:circle cx="4" cy="4.6" r="3.4" [attr.fill]="fruit().skin" [attr.stroke]="fruit().skinEdge" stroke-width="0.65" />
          <svg:ellipse class="fruit-shine" cx="-5" cy="2" rx="1.1" ry="0.7" />
          <svg:ellipse class="fruit-shine" cx="2.9" cy="3.5" rx="1" ry="0.65" />
        }
        @case ('moras') {
          <svg:path class="fruit-stem" d="M 0 -7 C 0.3 -8.8 0.1 -10.4 0.8 -12" stroke-width="1" />
          <svg:path class="fruit-leaf" d="M 0 -6.6 L -2.2 -8.6 L -0.6 -6.9 Z" />
          <svg:path class="fruit-leaf" d="M 0.6 -6.7 L 2.8 -8.4 L 1.2 -6.8 Z" />
          @for (
            drupelet of [
              { x: 0, y: -4.8 },
              { x: -3, y: -2.4 },
              { x: 3, y: -2.4 },
              { x: 0, y: -1 },
              { x: -2.4, y: 1.6 },
              { x: 2.4, y: 1.6 },
              { x: 0, y: 4.2 }
            ];
            track drupelet.x + ':' + drupelet.y
          ) {
            <svg:circle
              [attr.cx]="drupelet.x" [attr.cy]="drupelet.y" r="2.4"
              [attr.fill]="fruit().skin"
              [attr.stroke]="fruit().skinEdge"
              stroke-width="0.55"
            />
          }
          <svg:ellipse [attr.fill]="fruit().blush" cx="-1" cy="-5.4" rx="1" ry="0.65" opacity="0.6" />
          <svg:ellipse class="fruit-shine" cx="-3.4" cy="-3.2" rx="0.9" ry="0.6" />
        }
        @default {
          <!-- manzana — the moss default, matching flowerFor's fallback law -->
          <svg:path class="fruit-stem" d="M 0 -6.5 C 0.5 -8.5 0.3 -10.5 1 -12" stroke-width="1.1" />
          <svg:path class="fruit-leaf" d="M 1 -10 Q 5.5 -12.5 8 -8.5 Q 4 -6.5 1 -10 Z" />
          <svg:path
            d="M 0 -6 C -6.5 -8.5 -9 -2.5 -7 2.5 C -5.5 6.5 -2 8 0 6.5 C 2 8 5.5 6.5 7 2.5 C 9 -2.5 6.5 -8.5 0 -6 Z"
            [attr.fill]="fruit().skin"
            [attr.stroke]="fruit().skinEdge"
            stroke-width="0.7"
          />
          <svg:ellipse cx="3" cy="0.5" rx="2.6" ry="3.4" [attr.fill]="fruit().blush" opacity="0.45" />
          <svg:ellipse class="fruit-shine" cx="-2.6" cy="-1.8" rx="2" ry="1.2" />
        }
      }
    </svg:g>
  `,
})
export class FruitGlyph {
  readonly fruit = input.required<FruitSpec>();
  readonly scale = input(1);
}
