import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from './repos/settings.service';
import { TreesRepo } from './repos/trees.repo';
import { BackupService } from './repos/backup.service';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';

/** A copy is "recent enough" for this long — then ONE gentle line. */
const NUDGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Boot dust settles first: repos hydrate, the check-in gate resolves. */
const BOOT_DELAY_MS = 8000;

/**
 * «Tu bosque, a salvo» (0.0.77): until the cloud arrives, the forest lives
 * and dies with this device — a lost phone loses everything. At most once
 * per ~30 days (counting from the last copy OR the last time we asked),
 * one toast offers to download a copy. Opt-out in Ajustes. Never a nag:
 * dismissing waits the full cycle again, the ritual is never interrupted,
 * nothing is counted or colored.
 */
@Injectable({ providedIn: 'root' })
export class BackupReminderService {
  private readonly settings = inject(SettingsService);
  private readonly trees = inject(TreesRepo);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  constructor() {
    setTimeout(() => this.maybeNudge(), BOOT_DELAY_MS);
  }

  private maybeNudge(): void {
    const s = this.settings.settings();
    if (!s.backupReminders) return;
    // Never over the ritual — this open simply stays quiet.
    if (this.router.url.startsWith('/check-in')) return;
    const live = this.trees.all().filter((t) => !t.archivedAt && !t.deletedAt);
    if (!live.length) return; // nothing to lose yet
    // Never copied and never asked → count from the forest's own age.
    const oldest = Math.min(...live.map((t) => t.createdAt));
    const baseline = Math.max(s.lastBackupAt ?? 0, s.lastBackupNudgeAt ?? 0) || oldest;
    if (Date.now() - baseline < NUDGE_AFTER_MS) return;
    void this.settings.patch({ lastBackupNudgeAt: Date.now() });
    this.toast.show(
      {
        message: this.i18n.t().settings.backupNudge,
        actionLabel: this.i18n.t().settings.backupNudgeGo,
        action: () => void this.backup.download(),
      },
      12000,
    );
  }
}
