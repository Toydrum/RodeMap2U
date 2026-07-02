import { Injectable, inject } from '@angular/core';
import { CheckIn, ExportEnvelope, SCHEMA_VERSION, Settings, TimerSession, Tree, TreeNode } from '../db/schema';
import { clear, getAll, putMany } from '../db/idb';
import { TreesRepo } from './trees.repo';
import { NodesRepo } from './nodes.repo';
import { CheckinsRepo } from './checkins.repo';
import { SessionsRepo } from './sessions.repo';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly trees = inject(TreesRepo);
  private readonly nodes = inject(NodesRepo);
  private readonly checkins = inject(CheckinsRepo);
  private readonly sessions = inject(SessionsRepo);
  private readonly settings = inject(SettingsService);

  async buildEnvelope(): Promise<ExportEnvelope> {
    // Read from disk (includes tombstones — a backup is a full copy).
    const [trees, nodes, checkins, sessions] = await Promise.all([
      getAll<Tree>('trees'),
      getAll<TreeNode>('nodes'),
      getAll<CheckIn>('checkins'),
      getAll<TimerSession>('sessions'),
    ]);
    return {
      app: 'rodemap2u',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: { trees, nodes, checkins, sessions, settings: this.settings.settings() },
    };
  }

  async download(filenamePrefix = 'rodemap2u-backup'): Promise<void> {
    const envelope = await this.buildEnvelope();
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${envelope.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Validate + replace-all. A backup of the CURRENT data is auto-downloaded
   * first, so a bad import is always recoverable. Merge-import is a v2 sync
   * problem — not half-built here.
   */
  async importReplace(json: string): Promise<void> {
    const envelope = JSON.parse(json) as ExportEnvelope;
    if (envelope.app !== 'rodemap2u') throw new Error('not a RodeMap2U backup');
    if (typeof envelope.schemaVersion !== 'number' || envelope.schemaVersion > SCHEMA_VERSION) {
      throw new Error('backup from a newer app version');
    }
    // (When SCHEMA_VERSION grows, run the same data-migration pipeline used
    // at DB open against envelope.data before writing.)

    await this.download('rodemap2u-pre-import');

    await Promise.all([clear('trees'), clear('nodes'), clear('checkins'), clear('sessions')]);
    await Promise.all([
      putMany('trees', envelope.data.trees ?? []),
      putMany('nodes', envelope.data.nodes ?? []),
      putMany('checkins', envelope.data.checkins ?? []),
      putMany('sessions', envelope.data.sessions ?? []),
    ]);

    this.trees.resetTo(envelope.data.trees ?? []);
    this.nodes.resetTo(envelope.data.nodes ?? []);
    this.checkins.resetTo(envelope.data.checkins ?? []);
    this.sessions.resetTo(envelope.data.sessions ?? []);
    if (envelope.data.settings) await this.settings.patch(envelope.data.settings);
  }
}
