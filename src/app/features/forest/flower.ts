import { Component, input } from '@angular/core';
import { FlowerSpec } from './flora';

/**
 * A bloom, drawn per species — used inside any SVG as <g appFlower ...>.
 * Base size ≈ 12px radius at scale 1; scale down for miniatures.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'g[appFlower]',
  template: `
    <svg:g [attr.transform]="'scale(' + scale() + ')'">
      @switch (flower().shape) {
        @case ('daisy') {
          @for (angle of [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]; track angle) {
            <svg:ellipse
              rx="2.6" ry="8.2" cy="-7"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.6"
            />
          }
          <svg:circle r="4.4" [attr.fill]="flower().heart" />
        }
        @case ('bell') {
          @for (angle of [-38, 0, 38]; track angle) {
            <svg:path
              d="M 0 1 C -5.5 -4 -4.5 -12 0 -14 C 4.5 -12 5.5 -4 0 1 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.7"
            />
          }
          <svg:circle r="3" cy="-1" [attr.fill]="flower().heart" />
        }
        @case ('star') {
          @for (angle of [0, 72, 144, 216, 288]; track angle) {
            <svg:path
              d="M 0 0 L -3.4 -7.5 L 0 -13.5 L 3.4 -7.5 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.6"
            />
          }
          <svg:circle r="3.4" [attr.fill]="flower().heart" />
        }
        @default {
          @for (angle of [0, 72, 144, 216, 288]; track angle) {
            <svg:ellipse
              rx="5" ry="8.6" cy="-8"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.7"
            />
          }
          <svg:circle r="4.6" [attr.fill]="flower().heart" />
        }
      }
    </svg:g>
  `,
})
export class FlowerGlyph {
  readonly flower = input.required<FlowerSpec>();
  readonly scale = input(1);
}
