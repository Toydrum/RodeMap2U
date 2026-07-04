/**
 * RodeMap2U data model — local-first, sync-ready.
 *
 * SCHEMA_VERSION: shape of the data (export envelope + migration pipeline).
 * DB_VERSION: IndexedDB structure (stores/indexes) — versioned separately.
 */
/** v2: additive TreeNode.trigger (optional — absent on old records ≡ null;
 *  no migration pass needed) + Settings.todayIntentions (merge-over-defaults).
 *  Old v1 backups import cleanly; v2 backups are refused by v1 apps. */
export const SCHEMA_VERSION = 2;
export const DB_VERSION = 1;
export const DB_NAME = 'rodemap2u';

/** Every synced record. IDs from crypto.randomUUID(). Timestamps epoch ms. */
export interface SyncBase {
  id: string;
  createdAt: number;
  /** Bumped on every write. */
  updatedAt: number;
  /** Starts at 1, increments on every write — LWW tiebreak for future sync. */
  rev: number;
  /** Sync tombstone. Records are never physically deleted. */
  deletedAt: number | null;
}

export type AccentToken =
  | 'moss'
  | 'sage'
  | 'sky'
  | 'clay'
  | 'lavender'
  | 'sand'
  | 'rose'
  | 'pine';

export interface Tree extends SyncBase {
  name: string;
  accent: AccentToken;
  /** Manual sort in the forest, sparse numbering (10, 20, 30…). */
  order: number;
  /** "Where I am" on this tree — moved by check-ins and branching. */
  currentNodeId: string | null;
  /** User-facing "put away" — recoverable, distinct from deletedAt. */
  archivedAt: number | null;
}

/**
 * Node lifecycle — deliberately no failure state:
 * seed: idea · growing: in motion · resting: paused on purpose
 * achieved: bloomed · branched: forked into alternatives (a feature, not a downgrade)
 */
export type NodeStatus = 'seed' | 'growing' | 'resting' | 'achieved' | 'branched';

export interface TreeNode extends SyncBase {
  treeId: string;
  /** null = the tree's root node. */
  parentId: string | null;
  title: string;
  note: string;
  status: NodeStatus;
  /** Sibling sort, sparse numbering. */
  order: number;
  /** Gentle deadline — date-only, local, optional. Never a timestamp. */
  targetDate: string | null;
  achievedAt: number | null;
  /** Stamped when this node became a branch point. */
  branchedAt: number | null;
  /** 'branch' = born as an alternative under a branched parent. */
  origin: 'planned' | 'branch';
  archivedAt: number | null;
  /** The user's own if-then plan ("cuando me sirva el café…") — free text,
   *  NEVER parsed or scheduled. Ahora re-presents it; nothing alarms.
   *  Optional: records born before v2 simply lack it (undefined ≡ null). */
  trigger?: string | null;
}

/** Emotional weather — closed tokens, no numeric scale, no valence judgment. */
export type Feeling = 'sunny' | 'calm' | 'foggy' | 'heavy' | 'stormy';

export interface CheckIn extends SyncBase {
  feeling: Feeling;
  note: string;
  /** "Where do you feel you are" — both optional. */
  treeId: string | null;
  nodeId: string | null;
}

export interface TimerSession extends SyncBase {
  nodeId: string | null;
  startedAt: number;
  plannedMinutes: number;
  /** null = still running (survives app close). No outcome flag — minutes are never judged. */
  endedAt: number | null;
  note: string;
}

export type Lang = 'es' | 'en';
export type ThemeName = 'organic' | 'terminal';
export type MotionPref = 'system' | 'on' | 'off';
export type TextSize = 'md' | 'lg' | 'xl';

/** Singleton — lives in the `meta` store under key 'settings'. */
export interface Settings {
  lang: Lang;
  theme: ThemeName;
  /** User override on top of prefers-reduced-motion. 'on' = reduce. */
  reduceMotion: MotionPref;
  textSize: TextSize;
  dyslexiaFont: boolean;
  timerDefaultMinutes: number;
  timerEndChime: boolean;
  /** 30-min cooldown so a PWA resume doesn't re-prompt the check-in. */
  lastCheckInAt: number | null;
  /** First-run flag for the welcome flow. */
  onboarded: boolean;
  /** Up to 3 branches chosen for today. Expires silently when the date
   *  moves on — no carryover, no history, no done/undone counts. */
  todayIntentions: { date: string; nodeIds: string[] } | null;
  /** Gentle whispers: orientation questions ("¿dónde sientes que estás?"),
   *  opt-in, never about work, never counted. 'surprise' = the forest picks
   *  an unpredictable moment (deterministic pseudo-random, 1.5–6 h). */
  whispersEnabled: boolean;
  whisperRhythm: 'often' | 'sometimes' | 'daily' | 'surprise';
  lastWhisperAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'es',
  theme: 'organic',
  reduceMotion: 'system',
  textSize: 'md',
  dyslexiaFont: false,
  timerDefaultMinutes: 20,
  timerEndChime: false,
  lastCheckInAt: null,
  onboarded: false,
  todayIntentions: null,
  whispersEnabled: false,
  whisperRhythm: 'sometimes',
  lastWhisperAt: null,
};

/** Versioned backup file format. */
export interface ExportEnvelope {
  app: 'rodemap2u';
  schemaVersion: number;
  exportedAt: string;
  data: {
    trees: Tree[];
    nodes: TreeNode[];
    checkins: CheckIn[];
    sessions: TimerSession[];
    settings: Settings | null;
  };
}

export function newSyncBase(now = Date.now()): SyncBase {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, rev: 1, deletedAt: null };
}

/** Stamp a mutation: bump rev + updatedAt. Use for every write. */
export function stamp<T extends SyncBase>(record: T, now = Date.now()): T {
  return { ...record, updatedAt: now, rev: record.rev + 1 };
}
