/**
 * RoadMap2U data model — local-first, sync-ready.
 *
 * SCHEMA_VERSION: shape of the data (export envelope + migration pipeline).
 * DB_VERSION: IndexedDB structure (stores/indexes) — versioned separately.
 */
/** v7: additive Preserve.size/premio/savedFor/openedAt («el premio del
 *  frasco» 0.0.90 — jam as self-granted reward + three vessels). No
 *  migration pass; pre-v7 jars read as frasco/sealed/no-premio forever.
 *  v6: NEW `preserves` store + additive Harvest.preserveId («la conservería»
 *  0.0.89 — sealed jam batches). Older backups lack both (imported as
 *  all-fresh, no jars); DB_VERSION 3 adds the store on lived-in devices.
 *  v5: NEW `harvests` store («la cosecha» 0.0.88) — the first new record
 *  type since launch. Older backups simply lack data.harvests (imported as
 *  empty; the backfill sentinel reconstructs the pantry from achieved
 *  branches). DB_VERSION 2 creates the object store on lived-in devices.
 *  v4: additive TreeNode.priority («la luz» — optional; absent ≡ steady
 *  default). Same policy as v2/v3: no migration pass, older backups import
 *  cleanly, newer backups are refused by older apps.
 *  v3: additive TreeNode.flow (optional — absent ≡ 'free'; 'steps' marks an
 *  ordered path of pasitos).
 *  v2: additive TreeNode.trigger (optional — absent on old records ≡ null;
 *  no migration pass needed) + Settings.todayIntentions (merge-over-defaults). */
export const SCHEMA_VERSION = 7;
export const DB_VERSION = 3;
/**
 * NAMING NOTE (2026-07-06): the app was renamed RodeMap2U → RoadMap2U and the
 * storage identifiers moved with it. Two legacy literals remain FOREVER:
 *   · LEGACY_DB_NAME — devices that used the app before the rename hold their
 *     forest under it; openDb() copies it into DB_NAME once (copy, not move —
 *     the old DB stays untouched as a safety net).
 *   · ExportEnvelope accepts app 'rodemap2u' on import — every backup ever
 *     downloaded keeps importing (backup.service.ts).
 * The `rm2u.*` localStorage prefix stays as-is: it abbreviates RoadMap2U too.
 */
export const DB_NAME = 'roadmap2u';
export const LEGACY_DB_NAME = 'rodemap2u';

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

/**
 * «La luz» — per-branch priority as light, never as rank (owner override of
 * the former "no priority fields" rule; guardrails in AGENTS.md).
 * sunlit: the sun looks here first (Ahora keeps it in mind).
 * shade: resting from the sun a season — alive, just yielding the ambient
 * turn (NOT 'resting': shade mutes resurfacing, resting pauses the branch).
 * Absent ≡ the steady default («a su ritmo») — no record ever stores it.
 */
export type NodePriority = 'sunlit' | 'shade';

/** Total light order for calm sorts: sun first, steady, then shade.
 *  Shared by the ranker, the tablita lens, the timer picker and date-review. */
export function lightRank(node: { priority?: NodePriority | null }): 0 | 1 | 2 {
  if (node.priority === 'sunlit') return 0;
  if (node.priority === 'shade') return 2;
  return 1;
}

/** «Brújula del tiempo» sizes, in minutes (60 = 1 h, 1440 = 1 día,
 *  10080 = 1 semana). The picker order; null = «ni idea». */
export type EstimateMin = 2 | 10 | 30 | 60 | 1440 | 10080;
export const ESTIMATE_CHOICES: (EstimateMin | null)[] = [2, 10, 30, 60, 1440, 10080, null];

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
  /** «Brújula del tiempo» — the user's own gentle size guess, in minutes
   *  (2/10/30 · 60 = 1 h · 1440 = 1 día · 10080 = 1 semana; null/absent =
   *  «ni idea», always a dignified answer). Optional + additive. Never
   *  charted, never averaged: after a session it earns at most ONE
   *  curiosity line (session-scale guesses only, ≤ 60) — dato, no
   *  calificación. */
  estimateMin?: EstimateMin | null;
  /** How this branch's pasitos grow: 'steps' = an ordered path (paso 1 → 2…)
   *  drawn as a chain that fills with flowers as stages bloom; 'free' = the
   *  parallel fan. Optional: records born before v3 lack it (undefined ≡ 'free').
   *  Never forced — the toggle lives in the node sheet. */
  flow?: 'free' | 'steps';
  /** «Sendero» (0.0.72): a steps path that quietly starts over each day —
   *  yesterday's bloomed steps reset to seed on the day flip. NO history,
   *  NO streaks, NO completion counts, NO times: today is today (TEACCH
   *  visual-schedule shape, doctrine-safe). Only meaningful with
   *  flow === 'steps'. Optional + additive. */
  repeatsDaily?: boolean;
  /** «La luz» (see NodePriority). Optional: records born before v4 lack it
   *  (undefined ≡ null ≡ steady). Never initialized on plant/branch — absent
   *  is the forever-default; `null` clears an earlier choice. */
  priority?: NodePriority | null;
}

/**
 * «La cosecha» (0.0.88) — one fruit per bloomed branch, persisted at the
 * moment of the bloom. THE PANTRY REGISTER: a harvest is a MEMORY of an
 * achievement and survives reopen/archive/delete (like Trail footprints),
 * while the almanaque/meadow keep showing only what STANDS — two registers,
 * both deliberate (owner decision 2026-07-14). Laws: fruits are never
 * spendable, never exchangeable, never gate anything; sendero daily steps
 * never bear fruit (a durable fruit minted daily is a streak in a costume).
 * Deterministic id 'h:' + nodeId — one row per branch, minting idempotent
 * (status-toggling can never farm fruit); a re-achieve re-stamps
 * harvestedAt + refreshes the snapshots (the row remembers the latest
 * season). Minting happens ONLY at the user-action layer — sync, import
 * and the daily sweep never mint.
 */
export interface Harvest extends SyncBase {
  nodeId: string;
  treeId: string;
  /** Snapshots at harvest time — the memory survives rename/archive/delete. */
  treeName: string;
  accent: AccentToken;
  title: string;
  /** The branch's achievedAt at mint. */
  harvestedAt: number;
  /** «La conservería» (0.0.89) — THE SINGLE-HOME FIELD: absent/null ≡ fresh
   *  (in the harvest jar); set = sealed into that jam batch. Membership
   *  lives ON THE MEMBER (never an array on the batch — two devices jamming
   *  different fruits touch different records; LWW stays conflict-free).
   *  Additive like trigger/flow/priority; set ONLY by the seal ritual —
   *  sync/import/backfill never set it. Nada se gasta; todo se conserva. */
  preserveId?: string | null;
}

/** The one place the harvest id law lives. */
export function harvestIdFor(nodeId: string): string {
  return 'h:' + nodeId;
}

/**
 * «La conservería» (0.0.89) — a sealed jam batch. Made OF fruits, never an
 * exchange: sealing changes each member's HOME (preserveId), never its
 * existence or visibility — the register shows every fruit forever and the
 * jar opens to its members' memory cards. Batches are FINAL after the undo
 * toast window (preserves don't un-cook; nothing was lost, so permanence
 * costs nothing). All jars render the same size and the same fullness —
 * quantity is never visualized. Ids are randomUUID: every seal is a new
 * batch (concurrent seals on two devices = two legitimate jars).
 */
export type PreserveKind = 'mermelada';

/** «El frasco sirve a la fruta» (0.0.90, owner override of same-size):
 *  the vessel reflects the BATCH — a seal-time snapshot via jarSizeFor
 *  (1–2 frasquito · 3–5 frasco · 6+ frascote). Thresholds are PUBLISHED in
 *  the guide (predictability) but never computed forward on a working
 *  surface (no pot counters/previews — the tier speaks once, at Envasar,
 *  past-facing). A frasquito is its own kind of jar, never a lesser one. */
export type JarVessel = 'frasquito' | 'frasco' | 'frascote';

export interface Preserve extends SyncBase {
  kind: PreserveKind;
  /** The user's own words — prefilled with the derived flavor, editable. */
  name: string;
  madeAt: number;
  /** Snapshot at seal: the single species' accent, or null = mixed
   *  («mermelada del bosque», first-class). */
  accent: AccentToken | null;
  /** The jam color — blended from the member fruits' skins at seal. */
  tint: string;
  tintEdge: string;
  /** Vessel snapshot at seal (absent ≡ 'frasco' — pre-v7 jars keep today's
   *  glass forever; a jar must never resize when sync lands members late). */
  size?: JarVessel;
  /** «El premio del frasco» (0.0.90): the user's OWN reward/permission,
   *  claimed by opening the jam. NEVER parsed, valued, priced, scheduled
   *  or suggested by the app (the trigger law) — as intimate as trigger.
   *  «La app es la alacena, nunca la caja registradora.» */
  premio?: string | null;
  /** Optional intención («para cuando termine el semestre») — free text,
   *  re-spoken in the jar panel, NEVER enforced, never shown at opening
   *  (no «you said you'd wait» energy exists anywhere in this app). */
  savedFor?: string | null;
  /** «Se abre una vez; se conserva siempre»: the claiming stamp. An opened
   *  jar stays on its shelf «disfrutada» — lid off, never greyed; what was
   *  consumed is the REAL-WORLD permission, never the memories. The app
   *  never locks, expires or nudges a jar. */
  openedAt?: number | null;
}

/** Emotional weather — closed tokens, no numeric scale, no valence judgment. */
export type Feeling = 'sunny' | 'calm' | 'foggy' | 'heavy' | 'stormy';

/** The one weather-emoji vocabulary (trail, almanaque — never re-copied). */
export const FEELING_EMOJI: Record<Feeling, string> = {
  sunny: '☀️',
  calm: '🌤',
  foggy: '🌫',
  heavy: '🌧',
  stormy: '⛈',
};

export interface CheckIn extends SyncBase {
  feeling: Feeling;
  note: string;
  /** "Where do you feel you are" — both optional. */
  treeId: string | null;
  nodeId: string | null;
  /** «¿Cuánta agua trae tu regadera?» — optional energy token (AuDHD
   *  energy accounting). Additive + optional like `trigger`; absent ≡
   *  unknown. NEVER a score, never charted, never compared across days —
   *  it only biases TODAY's suggestion toward smaller doors. */
  energy?: 'llena' | 'media' | 'bajita' | null;
}

export interface TimerSession extends SyncBase {
  nodeId: string | null;
  startedAt: number;
  plannedMinutes: number;
  /** null = still running (survives app close). No outcome flag — minutes are never judged. */
  endedAt: number | null;
  note: string;
  /** Non-null while paused — PERSISTED so a reload adopts the pause honestly
   *  instead of silently converting the paused span into "worked" minutes.
   *  Optional + additive: older rows read as never-paused. */
  pausedAt?: number | null;
  /** Total paused ms so far — subtracted from every minutes computation. */
  pausedMs?: number;
}

export type Lang = 'es' | 'en';
export type ThemeName = 'organic' | 'terminal';
export type MotionPref = 'system' | 'on' | 'off';
export type TextSize = 'md' | 'lg' | 'xl';

/**
 * The `meta` store is key-value; its known keys:
 *   'settings'      — the Settings singleton below (exported in backups).
 *   'auth.identity' — device session snapshot (core/auth/auth-types.ts).
 *   'family.me'     — cached GET /me for instant offline paint
 *                     (core/family.service.ts, stale-while-revalidate).
 *   'account.link'  — which account this device's forest travels with
 *                     (core/sync/sync.service.ts; null accountId = unlinked).
 *   'sync.state'    — push watermark + pull cursor + lastSyncAt + dirty ids
 *                     (core/sync/sync.service.ts bookkeeping).
 *   'legacy.migratedAt' — the pre-rename DB question is settled for this
 *                     device (core/db/idb.ts, written WITH the copied rows).
 * Auth/sync keys are deliberately NOT part of ExportEnvelope: backups are
 * shared files, and identity/link state is device state, not forest data.
 */

/** Singleton — lives in the `meta` store under key 'settings'. */
export interface Settings {
  lang: Lang;
  theme: ThemeName;
  /** User override on top of prefers-reduced-motion. 'on' = reduce. */
  reduceMotion: MotionPref;
  textSize: TextSize;
  dyslexiaFont: boolean;
  timerDefaultMinutes: number;
  /** The golden approach-bridge fires this many minutes before the planted
   *  time — hyperfocus exit-ramp / transition preparation. Visual only. */
  bridgeMinutes: 2 | 5;
  /** Surfaces whose first-visit «¿qué es esto?» hint was dismissed. */
  hintsSeen: string[];
  /** «Brújula del tiempo»: opt-in curiosity line after a session on an
   *  estimated branch. OFF by default — time feedback can shame. */
  timeCompass: boolean;
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
  /** "Prefiero empezar en blanco" — hides the starter saplings for good. */
  startersHidden: boolean;
  /** The user's own quick-path chips for the branch flow (max 6). */
  customBranchChips: string[];
  /** «Tu bosque, a salvo» (0.0.77): local-first means the forest lives and
   *  dies with this device until the cloud arrives. One gentle opt-OUT
   *  reminder line at most every ~30 days — never a nag, never counted. */
  lastBackupAt: number | null;
  lastBackupNudgeAt: number | null;
  backupReminders: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'es',
  theme: 'organic',
  reduceMotion: 'system',
  textSize: 'md',
  dyslexiaFont: false,
  timerDefaultMinutes: 20,
  bridgeMinutes: 2,
  hintsSeen: [],
  timeCompass: false,
  lastCheckInAt: null,
  onboarded: false,
  todayIntentions: null,
  whispersEnabled: false,
  whisperRhythm: 'sometimes',
  lastWhisperAt: null,
  startersHidden: false,
  customBranchChips: [],
  lastBackupAt: null,
  lastBackupNudgeAt: null,
  backupReminders: true,
};

/** Versioned backup file format. 'rodemap2u' = pre-rename id, import-only. */
export interface ExportEnvelope {
  app: 'roadmap2u' | 'rodemap2u';
  schemaVersion: number;
  exportedAt: string;
  data: {
    trees: Tree[];
    nodes: TreeNode[];
    checkins: CheckIn[];
    sessions: TimerSession[];
    /** Absent on pre-v5 backups — imported as empty, never refused. */
    harvests?: Harvest[];
    /** Absent on pre-v6 backups — imported as no jars, never refused. */
    preserves?: Preserve[];
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
