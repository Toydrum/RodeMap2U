import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nService } from './core/i18n/i18n.service';
import { ThemeService } from './core/theme/theme.service';
import { MotionService } from './core/motion.service';
import { UpdateService } from './core/update.service';
import { AccompanimentService } from './core/accompaniment.service';
import { FocusSessionService } from './core/focus-session.service';
import { ToastService } from './shared/ui/toast.service';
import { BirdState, CompanionBird, birdStateFrom } from './features/timer/companion-bird';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CompanionBird],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly toast = inject(ToastService);
  protected readonly focus = inject(FocusSessionService); // adopts open sessions + owns the 🌸 cue from boot
  private readonly router = inject(Router);

  private readonly url = toSignal(this.router.events.pipe(map(() => this.router.url)), {
    initialValue: this.router.url,
  });

  /** The check-in is a full-screen ritual — no tab bar there. */
  protected readonly showTabs = computed(() => !this.url().startsWith('/check-in'));

  /** The traveling perch: the companion follows a live session everywhere
   *  EXCEPT the two surfaces that already hold their own bird. */
  protected readonly showPerch = computed(() => {
    if (!this.focus.active() || !this.showTabs()) return false;
    const url = this.url();
    return !url.startsWith('/timer') && !url.startsWith('/ahora');
  });

  protected readonly birdState = computed<BirdState>(() =>
    birdStateFrom(this.focus.paused(), this.focus.overtime(), this.focus.plannedMs() - this.focus.elapsedMs()),
  );

  constructor() {
    inject(ThemeService); // instantiates the <html> attribute effects
    inject(MotionService);
    inject(UpdateService).init();
    inject(AccompanimentService).init(); // gentle whisper rhythm (opt-in)
  }
}
