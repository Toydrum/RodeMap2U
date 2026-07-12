import { Injectable, inject } from '@angular/core';
import { CheckIn, ExportEnvelope, SCHEMA_VERSION, Settings, TimerSession, Tree, TreeNode } from '../db/schema';
import { clear, getAll, putMany } from '../db/idb';
import { broadcastChange } from '../db/broadcast';
import { SyncService } from '../sync/sync.service';
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
  private readonly sync = inject(SyncService);

  async buildEnvelope(): Promise<ExportEnvelope> {
    // Read from disk (includes tombstones — a backup is a full copy).
    const [trees, nodes, checkins, sessions] = await Promise.all([
      getAll<Tree>('trees'),
      getAll<TreeNode>('nodes'),
      getAll<CheckIn>('checkins'),
      getAll<TimerSession>('sessions'),
    ]);
    return {
      app: 'roadmap2u',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: { trees, nodes, checkins, sessions, settings: this.settings.settings() },
    };
  }

  async download(filenamePrefix = 'roadmap2u-backup'): Promise<void> {
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
    // 'rodemap2u' is the pre-rename envelope id — accepted FOREVER so every
    // backup ever downloaded keeps importing (naming note in schema.ts).
    if (envelope.app !== 'roadmap2u' && envelope.app !== 'rodemap2u') {
      throw new Error('not a RoadMap2U backup');
    }
    if (typeof envelope.schemaVersion !== 'number' || envelope.schemaVersion > SCHEMA_VERSION) {
      throw new Error('backup from a newer app version');
    }
    // Validate the WHOLE shape before touching disk: a malformed file that
    // passed the header checks used to wipe the stores and THEN throw —
    // empty forest on next reload.
    const data = envelope.data;
    if (!data || typeof data !== 'object') throw new Error('backup has no data');
    const trees = data.trees ?? [];
    const nodes = data.nodes ?? [];
    const checkins = data.checkins ?? [];
    const sessions = data.sessions ?? [];
    for (const list of [trees, nodes, checkins, sessions]) {
      if (!Array.isArray(list) || list.some((r) => typeof r?.id !== 'string')) {
        throw new Error('backup data is malformed');
      }
    }
    // (When SCHEMA_VERSION grows, run the same data-migration pipeline used
    // at DB open against envelope.data before writing.)

    // Records the import REMOVES must also be announced, or a second tab's
    // in-memory copy resurrects them on its next save.
    const removedIds = {
      trees: this.trees.all().map((r) => r.id),
      nodes: this.nodes.all().map((r) => r.id),
      checkins: this.checkins.all().map((r) => r.id),
      sessions: this.sessions.all().map((r) => r.id),
    };

    await this.download('roadmap2u-pre-import');

    await Promise.all([clear('trees'), clear('nodes'), clear('checkins'), clear('sessions')]);
    await Promise.all([
      putMany('trees', trees),
      putMany('nodes', nodes),
      putMany('checkins', checkins),
      putMany('sessions', sessions),
    ]);

    this.trees.resetTo(trees);
    this.nodes.resetTo(nodes);
    this.checkins.resetTo(checkins);
    this.sessions.resetTo(sessions);
    if (data.settings) await this.settings.patch(data.settings);

    // Other tabs re-read what the import replaced (same rail as every write);
    // ids no longer on disk get DROPPED from their memory by refreshFromDisk.
    const union = (kept: { id: string }[], removed: string[]) => [
      ...new Set([...removed, ...kept.map((r) => r.id)]),
    ];
    broadcastChange({ store: 'trees', ids: union(trees, removedIds.trees) });
    broadcastChange({ store: 'nodes', ids: union(nodes, removedIds.nodes) });
    broadcastChange({ store: 'checkins', ids: union(checkins, removedIds.checkins) });
    broadcastChange({ store: 'sessions', ids: union(sessions, removedIds.sessions) });

    // An explicit restore must WIN over the cloud — without this, the next
    // pull silently resurrects whatever the backup rolled back (cloud revs
    // are higher than the restored ones). Persistent flag: covers offline
    // imports and import-before-connect too.
    await this.sync.noteRestore();
  }
}
