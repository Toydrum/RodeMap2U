import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from './repos/settings.service';
import { TreesRepo } from './repos/trees.repo';
import { BackupService } from './repos/backup.service';
import { ToastService } from '../shared/ui/toast.service';
import { I18nService } from './i18n/i18n.service';
import { SyncService } from './sync/sync.service';

/** A copy is "recent enough" for this long — then ONE gentle line. */
const NUDGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Boot dust settles first: repos hydrate, the check-in gate resolves. */
const BOOT_DELAY_MS = 8000;

/**
 * «Tu bosque, a salvo» (0.0.77): until the cloud arrives, the forest lives
 * and dies with this device — a lost phone loses everything. At most once
 * per ~30 days (counting from the last copy OR the last time we asked),
 * one toast offers to download a copy. Opt-out in Ajustes. Never a nag:
 * dismissing waits the full cycle again, rituals/visits are never
 * interrupted, the toast YIELDS to any newcomer (an Undo must never wait
 * behind it), and a sync-connected forest is never nagged — the cloud IS
 * its copy. The very first evaluation with no stamps ARMS the clock
 * silently instead of nudging (synced-in or pre-0.0.77 forests carry old
 * createdAt dates; "un-backed-up for years" on a fresh device would read
 * as a scold, not an offer).
 */
@Injectable({ providedIn: 'root' })
export class BackupReminderService {
  private readonly settings = inject(SettingsService);
  private readonly trees = inject(TreesRepo);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sync = inject(SyncService);

  constructor() {
    setTimeout(() => this.maybeNudge(), BOOT_DELAY_MS);
  }

  private maybeNudge(): void {
    const s = this.settings.settings();
    if (!s.backupReminders) return;
    // A connected forest already travels — the cloud is its safety copy.
    if (this.sync.link()) return;
    // Never over the ritual, the auth flow, or someone ELSE's forest —
    // this open simply stays quiet.
    const url = this.router.url;
    if (url.startsWith('/check-in') || url.startsWith('/account') || url.startsWith('/visit')) return;
    const live = this.trees.all().filter((t) => !t.archivedAt && !t.deletedAt);
    if (!live.length) return; // nothing to lose yet
    if (s.lastBackupAt === null && s.lastBackupNudgeAt === null) {
      // First sight of an unstamped forest: arm the 30-day clock quietly.
      void this.settings.patch({ lastBackupNudgeAt: Date.now() });
      return;
    }
    const baseline = Math.max(s.lastBackupAt ?? 0, s.lastBackupNudgeAt ?? 0);
    if (Date.now() - baseline < NUDGE_AFTER_MS) return;
    void this.settings.patch({ lastBackupNudgeAt: Date.now() });
    this.toast.show(
      {
        message: this.i18n.t().settings.backupNudge,
        actionLabel: this.i18n.t().settings.backupNudgeGo,
        action: () => void this.backup.download(),
        yields: true,
      },
      12000,
    );
  }
}
