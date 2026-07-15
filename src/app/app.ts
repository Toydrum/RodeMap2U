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
import { DailyPathsService } from './core/daily-paths.service';
import { BackupReminderService } from './core/backup-reminder.service';
import { PerchAnchorService } from './core/perch-anchor.service';
import { ToastService } from './shared/ui/toast.service';
import { PerchBody } from './shared/ui/perch-body';
import { BloomBurstHost } from './shared/ui/bloom-burst';
import { HarvestSkyHost } from './shared/ui/harvest-sky';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PerchBody, BloomBurstHost, HarvestSkyHost],
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

  /** Full-screen rituals (check-in, account) hide the tab bar. A third such
   *  route is the cue to move this onto route data instead of prefixes. */
  protected readonly showTabs = computed(() => {
    const url = this.url();
    return !url.startsWith('/check-in') && !url.startsWith('/account');
  });

  private readonly anchor = inject(PerchAnchorService);

  /** The traveling perch: the companion follows a live session everywhere
   *  EXCEPT the two surfaces that already hold their own bird — and yields
   *  whenever a SCENE holds the parakeet (perched on the session's branch
   *  in the tree view, or on the session tree's crown in the meadow). */
  protected readonly showPerch = computed(() => {
    if (!this.focus.active() || !this.showTabs() || this.anchor.claimed()) return false;
    const url = this.url();
    return !url.startsWith('/timer') && !url.startsWith('/ahora');
  });


  constructor() {
    inject(ThemeService); // instantiates the <html> attribute effects
    inject(MotionService);
    inject(UpdateService).init();
    inject(AccompanimentService).init(); // gentle whisper rhythm (opt-in)
    inject(DailyPathsService); // «senderos»: quiet day-flip reset effect
    inject(BackupReminderService); // «tu bosque, a salvo»: ~30-day gentle copy offer
  }
}
