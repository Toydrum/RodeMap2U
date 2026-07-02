import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nService } from './core/i18n/i18n.service';
import { ThemeService } from './core/theme/theme.service';
import { MotionService } from './core/motion.service';
import { UpdateService } from './core/update.service';
import { ToastService } from './shared/ui/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly url = toSignal(this.router.events.pipe(map(() => this.router.url)), {
    initialValue: this.router.url,
  });

  /** The check-in is a full-screen ritual — no tab bar there. */
  protected readonly showTabs = computed(() => !this.url().startsWith('/check-in'));

  constructor() {
    inject(ThemeService); // instantiates the <html> attribute effects
    inject(MotionService);
    inject(UpdateService).init();
  }
}
