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
        @case ('poppy') {
          <!-- four silky overlapping petals, dark heart, three stamens -->
          @for (angle of [45, 135, 225, 315]; track angle) {
            <svg:ellipse
              rx="6.2" ry="7.8" cy="-5.2"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.7"
            />
          }
          <svg:circle r="3" [attr.fill]="flower().heart" />
          @for (angle of [0, 120, 240]; track angle) {
            <svg:circle
              r="0.9" cy="-3.6"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petalEdge"
            />
          }
        }
        @case ('lupine') {
          <!-- a climbing raceme: little bells shrinking up a spike -->
          <svg:line x1="0" y1="1" x2="0" y2="-13.5" [attr.stroke]="flower().petalEdge" stroke-width="1" />
          @for (bud of [
            { y: 0, x: 1.8, r: 2.5 },
            { y: -3, x: -1.8, r: 2.3 },
            { y: -6, x: 1.7, r: 2.1 },
            { y: -8.8, x: -1.5, r: 1.9 },
            { y: -11.4, x: 1.2, r: 1.7 },
            { y: -13.6, x: -0.8, r: 1.5 }
          ]; track bud.y) {
            <svg:circle
              [attr.cx]="bud.x" [attr.cy]="bud.y" [attr.r]="bud.r"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.55"
            />
          }
          <svg:circle r="1.6" cy="1" [attr.fill]="flower().heart" />
        }
        @case ('anemone') {
          <!-- seven plump petals around a wide dark eye -->
          @for (angle of [0, 51.4, 102.9, 154.3, 205.7, 257.1, 308.6]; track angle) {
            <svg:ellipse
              rx="3.4" ry="7" cy="-6"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.6"
            />
          }
          <svg:circle r="3.6" [attr.fill]="flower().heart" />
          <svg:circle r="1.4" [attr.fill]="flower().petalEdge" opacity="0.75" />
        }
        @case ('trumpet') {
          <!-- one face-on disc with a soft inner star and a bright throat -->
          <svg:circle r="6.8" [attr.fill]="flower().petal" [attr.stroke]="flower().petalEdge" stroke-width="0.9" />
          @for (angle of [0, 72, 144, 216, 288]; track angle) {
            <svg:path
              d="M 0 -1.2 L -1.6 -5.4 L 0 -6.6 L 1.6 -5.4 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petalEdge"
              opacity="0.45"
            />
          }
          <svg:circle r="2.2" [attr.fill]="flower().heart" />
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
