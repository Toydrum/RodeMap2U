import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';

/** Gentle SW updates: offer, never force. */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private lastCheck = 0;

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        this.toast.show({
          message: `${this.i18n.t().update.ready} · ${this.i18n.t().update.action}`,
          actionLabel: this.i18n.t().update.reload,
          // Even if activation fails (degraded SW), a full reload fetches fresh.
          action: () =>
            void this.swUpdate
              .activateUpdate()
              .then(() => location.reload())
              .catch(() => location.reload()),
        });
      });

    this.swUpdate.unrecoverable.subscribe(() => location.reload());

    const check = () => {
      const now = Date.now();
      if (now - this.lastCheck < 600_000) return; // at most every 10 min
      this.lastCheck = now;
      // Offline or mid-deploy checks reject — quiet console, retry next beat.
      void this.swUpdate.checkForUpdate().catch(() => {});
    };
    check();
    // Long-lived windows still hear about new versions: on return, on
    // reconnect, and on a gentle 15-minute heartbeat.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    window.addEventListener('online', check);
    setInterval(check, 900_000);
  }
}
