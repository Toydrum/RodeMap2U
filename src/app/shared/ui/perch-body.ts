import { Component, inject, input } from '@angular/core';
import { FocusSessionService } from '../../core/focus-session.service';
import { CompanionBird } from '../../features/timer/companion-bird';

/**
 * The INSIDE of every session perch (B5, 0.0.78) — parakeet + elapsed-time
 * chip, reading the ONE shared pose straight from FocusSessionService.
 * Three hand-copied bodies used to live in app shell / tree canvas /
 * forest. The HOST `.session-perch` anchor (positioning, variant class,
 * routerLink, aria) stays with each surface — anchoring strategies are
 * genuinely different; the body never is. `:host { display: contents }`
 * keeps the anchor's own flex layout in charge.
 *
 * Only render inside a live session (the perch doctrine: presence means
 * "your session is alive and I'm with you").
 */
@Component({
  selector: 'app-perch-body',
  imports: [CompanionBird],
  template: `
    <app-companion-bird [state]="focus.birdState()" [seed]="focus.active()!.sessionId" />
    @if (twig()) {
      <svg class="twig" viewBox="0 0 34 6" aria-hidden="true">
        <path d="M 1 3 Q 17 1 33 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    }
    <span class="perch-time" role="timer">{{ focus.display() }}</span>
  `,
  styles: `
    :host {
      display: contents;
    }

    app-companion-bird {
      width: 30px;
      margin-bottom: -2px;
    }

    :host-context(.on-branch) app-companion-bird {
      width: 32px;
      margin-bottom: 0;
    }

    :host-context(.on-tree) app-companion-bird {
      margin-bottom: 0;
    }

    .twig {
      width: 34px;
      height: 6px;
      color: var(--status-branched);
    }

    .perch-time {
      font-size: 0.78rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-dim);
      margin-top: 0.15rem;
    }

    :host-context(.on-branch) .perch-time,
    :host-context(.on-tree) .perch-time {
      font-size: 0.72rem;
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      border-radius: 999px;
      padding: 0.05rem 0.4rem;
      margin-top: 0;
      margin-bottom: 4px;
    }
  `,
})
export class PerchBody {
  protected readonly focus = inject(FocusSessionService);
  /** The corner perch shows the golden twig; scene perches stand on real wood. */
  readonly twig = input(false);
}
