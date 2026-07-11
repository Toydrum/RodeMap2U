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
        @case ('sunflower') {
          <!-- twelve pointed petals around a ring — the classic open center -->
          @for (angle of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]; track angle) {
            <svg:path
              d="M 0 -4.6 L -2 -9 L 0 -13.5 L 2 -9 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.5"
            />
          }
          <svg:circle r="4.4" fill="none" [attr.stroke]="flower().heart" stroke-width="2.4" />
        }
        @case ('clover') {
          <!-- four broad, contented petals -->
          @for (angle of [45, 135, 225, 315]; track angle) {
            <svg:ellipse
              rx="5.8" ry="6.4" cy="-5.5"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.7"
            />
          }
          <svg:circle r="2.6" [attr.fill]="flower().heart" />
        }
        @case ('tulip') {
          <!-- one face-on cup crowned with three points -->
          <svg:path
            d="M -5.2 1 C -6.2 -6 -5.8 -10 -5 -12.5 L -2.6 -8.5 L 0 -13.5 L 2.6 -8.5 L 5 -12.5 C 5.8 -10 6.2 -6 5.2 1 Z"
            [attr.fill]="flower().petal"
            [attr.stroke]="flower().petalEdge"
            stroke-width="0.8"
          />
          <svg:ellipse rx="2.1" ry="1.4" cy="-1" [attr.fill]="flower().heart" />
        }
        @case ('carnation') {
          <!-- five ruffled petals, edges torn like crepe paper -->
          @for (angle of [0, 72, 144, 216, 288]; track angle) {
            <svg:path
              d="M 0 -2 C -4.4 -3.4 -5.6 -7 -4.8 -9.6 L -3.2 -8.2 L -2.4 -10.8 L -0.8 -9 L 0 -11.6 L 0.8 -9 L 2.4 -10.8 L 3.2 -8.2 L 4.8 -9.6 C 5.6 -7 4.4 -3.4 0 -2 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.55"
            />
          }
          <svg:circle r="2.8" [attr.fill]="flower().heart" />
        }
        @case ('pinwheel') {
          <!-- five heart-shaped petals, notches to the sky -->
          @for (angle of [0, 72, 144, 216, 288]; track angle) {
            <svg:path
              d="M 0 -2 C -4.6 -4.2 -5 -9.4 -2.6 -11.2 C -1.2 -12.2 -0.2 -11.4 0 -10.2 C 0.2 -11.4 1.2 -12.2 2.6 -11.2 C 5 -9.4 4.6 -4.2 0 -2 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.6"
            />
          }
          <svg:circle r="3" [attr.fill]="flower().heart" />
        }
        @case ('jasmine') {
          <!-- six slim petals coming to a point -->
          @for (angle of [0, 60, 120, 180, 240, 300]; track angle) {
            <svg:path
              d="M 0 -3 C -2.1 -5 -2.3 -9 0 -13 C 2.3 -9 2.1 -5 0 -3 Z"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.55"
            />
          }
          <svg:circle r="2.2" [attr.fill]="flower().heart" />
        }
        @case ('spray') {
          <!-- a little fountain: thin stems arcing out, a spark at each tip -->
          @for (arc of [
            { d: 'M 0 1 C -1 -4 -5.5 -7.5 -9.5 -9.5', tx: -9.5, ty: -9.5 },
            { d: 'M 0 1 C -0.8 -5 -3.6 -9 -6 -12', tx: -6, ty: -12 },
            { d: 'M 0 1 C -0.3 -6 -1.5 -10 -2.3 -13.4', tx: -2.3, ty: -13.4 },
            { d: 'M 0 1 C 0 -6 0.4 -10.5 0.8 -14', tx: 0.8, ty: -14 },
            { d: 'M 0 1 C 0.5 -6 2 -10 3.4 -13.2', tx: 3.4, ty: -13.2 },
            { d: 'M 0 1 C 1 -5 4.2 -8.8 7 -11.4', tx: 7, ty: -11.4 },
            { d: 'M 0 1 C 1.2 -3.6 6 -7 10 -8.6', tx: 10, ty: -8.6 }
          ]; track arc.d) {
            <svg:path [attr.d]="arc.d" fill="none" [attr.stroke]="flower().petal" stroke-width="1.1" stroke-linecap="round" />
            <svg:circle [attr.cx]="arc.tx" [attr.cy]="arc.ty" r="0.9" [attr.fill]="flower().petalEdge" />
          }
          <svg:circle r="1.6" cy="1" [attr.fill]="flower().heart" />
        }
        @case ('dahlia') {
          <!-- two layered rows of petals, dense and celebratory -->
          @for (angle of [0, 45, 90, 135, 180, 225, 270, 315]; track angle) {
            <svg:ellipse
              rx="3" ry="7.4" cy="-6.6"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.55"
            />
          }
          @for (angle of [36, 108, 180, 252, 324]; track angle) {
            <svg:ellipse
              rx="2.4" ry="4.6" cy="-4.2"
              [attr.transform]="'rotate(' + angle + ')'"
              [attr.fill]="flower().petal"
              [attr.stroke]="flower().petalEdge"
              stroke-width="0.55"
            />
          }
          <svg:circle r="2.4" [attr.fill]="flower().heart" />
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
