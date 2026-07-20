import { CheckIn, TimerSession, Tree, TreeNode, lightRank } from '../../core/db/schema';
import { cadenceOf, isScheduledOn } from '../../core/cadence';
import { heartIds, isContainerHeart } from '../../core/heart';
import { hash } from '../forest/tree-layout';

/**
 * The companion's brain — PURE functions, no Angular.
 *
 * Doctrine (AGENTS.md): Ahora shows exactly ONE suggestion, never a list.
 * It is always explainable (kind → reason line), always overridable
 * ("Otra idea" walks a deterministic, day-stable cycle), and it NEVER
 * suggests 'resting' (paused on purpose), 'achieved', 'branched', or
 * anything living in an archived tree. It never schedules and never
 * counts refusals.
 */

export type SuggestKind =
  | 'today'
  | 'trigger'
  | 'sunlit'
  | 'caminito'
  | 'step-of-current'
  | 'step-in-order'
  | 'current'
  | 'recent'
  | 'fresh-growing'
  | 'fresh-seed';

export interface Suggestion {
  node: TreeNode;
  tree: Tree;
  /** For 'step-of-current': the thread node this pasito hangs from. */
  parent: TreeNode | null;
  kind: SuggestKind;
  /** True when a «regadera bajita» day floated this SMALL door up — the
   *  reason line says so honestly. Never set on today/trigger (explicit
   *  now needs no excuse). */
  lowEnergy?: boolean;
}

export interface ThreadContext {
  node: TreeNode;
  tree: Tree;
  source: 'session' | 'checkin' | 'pointer';
  /** Epoch ms of the moment that made this the thread. */
  at: number;
  /** Whole minutes — only for source 'session'. */
  minutes: number | null;
}

export const POOL_CAP = 12;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The most recently meaningful "you were here" — reconstruction done FOR
 *  the user (resumption-lag science). The thread MAY be achieved/branched/
 *  resting: orientation shows honest history; only the suggestion filters. */
export function resolveThread(
  activeTrees: Tree[],
  nodesById: ReadonlyMap<string, TreeNode>,
  sessions: TimerSession[],
  checkins: CheckIn[],
): ThreadContext | null {
  const treeById = new Map(activeTrees.map((t) => [t.id, t]));
  // byId() is the RAW map — tombstoned/archived records included. Re-validate.
  const valid = (id: string | null | undefined): TreeNode | null => {
    if (!id) return null;
    const node = nodesById.get(id);
    if (!node || node.deletedAt || node.archivedAt) return null;
    return treeById.has(node.treeId) ? node : null;
  };

  const candidates: ThreadContext[] = [];

  const lastSession = [...sessions]
    .filter((s) => s.endedAt !== null && valid(s.nodeId))
    .sort((a, b) => b.endedAt! - a.endedAt!)[0];
  if (lastSession) {
    const node = valid(lastSession.nodeId)!;
    candidates.push({
      node,
      tree: treeById.get(node.treeId)!,
      source: 'session',
      at: lastSession.endedAt!,
      minutes: Math.max(1, Math.round((lastSession.endedAt! - lastSession.startedAt) / 60_000)),
    });
  }

  const lastCheckin = [...checkins]
    .filter((c) => valid(c.nodeId))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (lastCheckin) {
    const node = valid(lastCheckin.nodeId)!;
    candidates.push({
      node,
      tree: treeById.get(node.treeId)!,
      source: 'checkin',
      at: lastCheckin.createdAt,
      minutes: null,
    });
  }

  const pointerTree = [...activeTrees]
    .filter((t) => valid(t.currentNodeId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (pointerTree) {
    candidates.push({
      node: valid(pointerTree.currentNodeId)!,
      tree: pointerTree,
      source: 'pointer',
      at: pointerTree.updatedAt,
      minutes: null,
    });
  }

  if (!candidates.length) return null;
  // Freshest wins; ties resolve session > checkin > pointer (array order).
  return candidates.reduce((best, c) => (c.at > best.at ? c : best));
}

/** Priority-ordered candidate pool, deduped, capped. Buckets:
 *  P0 today's chosen intentions (in the user's own order),
 *  P0.5 branches carrying a "cuando-entonces" (the user's own if-then plan
 *  — re-presenting it IS the mechanism), P0.75 «a pleno sol» branches (the
 *  user's standing light — BELOW their explicit now, above everything
 *  ambient; it biases, never tyrannizes), P1 pasitos of the thread node
 *  (tiny + concrete beats abstract), P2 the thread node itself,
 *  P3 momentum (sessions in the last 7 days — shaded branches yield here),
 *  P4 freshest growing, P5 freshest seeds (shade sorts last, never out). */
export function suggestionPool(
  activeTrees: Tree[],
  nodesByTree: ReadonlyMap<string, TreeNode[]>,
  childrenOf: (node: TreeNode) => TreeNode[],
  sessions: TimerSession[],
  checkins: CheckIn[],
  nodesById: ReadonlyMap<string, TreeNode>,
  todayIds: string[] = [],
  energy: 'llena' | 'media' | 'bajita' | null = null,
  day = '',
): Suggestion[] {
  const treeById = new Map(activeTrees.map((t) => [t.id, t]));
  const actionable = (n: TreeNode) => n.status === 'seed' || n.status === 'growing';
  const byFresh = (a: TreeNode, b: TreeNode) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);

  // «El corazón del árbol» (0.0.112): a heart WITH ramitas is a container,
  // never a task — ambient buckets skip it. The user's EXPLICIT now
  // (today's intentions, their own cuando-entonces) is never filtered (the
  // shade precedent), and a BARE heart stays the goal itself (the
  // first-pasito door and the regadera partition already treat it as big).
  const hearts = heartIds(nodesByTree);
  const containerHeart = (n: TreeNode) => isContainerHeart(n, hearts, childrenOf(n).length);

  const pool: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (node: TreeNode, kind: SuggestKind, parent: TreeNode | null = null) => {
    const tree = treeById.get(node.treeId);
    if (!tree || seen.has(node.id) || !actionable(node)) return;
    if (containerHeart(node) && kind !== 'today' && kind !== 'trigger') return;
    seen.add(node.id);
    pool.push({ node, tree, parent, kind });
  };

  for (const id of todayIds) {
    const node = nodesById.get(id);
    if (node && !node.deletedAt && !node.archivedAt) add(node, 'today');
  }

  const all = activeTrees.flatMap((t) => nodesByTree.get(t.id) ?? []);
  for (const node of all.filter((n) => n.trigger?.trim()).sort(byFresh)) add(node, 'trigger');

  for (const node of all.filter((n) => n.priority === 'sunlit').sort(byFresh)) add(node, 'sunlit');

  // P0.9 «el caminito de hoy» (0.0.103): exactly ONE ritual stone, day-stable
  // — on a threadless morning it becomes the suggestion, but the user's
  // explicit now (above) always outranks, «Otra idea» never becomes a chore
  // list (one entry), and this is a STATE read (live status = done this
  // period), never a schedule. Invitation, never a command.
  if (day) {
    const stones: { node: TreeNode; parent: TreeNode | null }[] = [];
    for (const node of all) {
      const cadence = cadenceOf(node);
      if (!cadence || node.status === 'branched') continue;
      if (!isScheduledOn(cadence, day)) continue;
      if (node.flow === 'steps') {
        if (node.status !== 'seed' && node.status !== 'growing') continue;
        const next = childrenOf(node).find((c) => c.status === 'seed' || c.status === 'growing');
        if (next) stones.push({ node: next, parent: node });
      } else if (node.status === 'seed' || node.status === 'growing') {
        stones.push({ node, parent: null });
      }
    }
    if (stones.length) {
      stones.sort((a, b) => a.node.id.localeCompare(b.node.id));
      const pick = stones[hash(day + ':caminito') % stones.length];
      add(pick.node, 'caminito', pick.parent);
    }
  }

  const thread = resolveThread(activeTrees, nodesById, sessions, checkins);
  if (thread) {
    // Order-asc children mean the earliest open pasito surfaces first — on a
    // 'steps' branch that IS "the next step of the path", and says so.
    const stepKind = thread.node.flow === 'steps' ? 'step-in-order' : 'step-of-current';
    for (const child of childrenOf(thread.node)) add(child, stepKind, thread.node);
    add(thread.node, 'current');
  }

  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const recent = [...sessions]
    .filter((s) => s.endedAt !== null && s.endedAt >= cutoff && s.nodeId)
    .sort((a, b) => b.endedAt! - a.endedAt!);
  for (const s of recent) {
    const node = nodesById.get(s.nodeId!);
    // Shaded branches yield the momentum echo — you shaded it AFTER working
    // on it; respect that. (Deliberate paths — today/trigger/thread — never
    // check the shade: you went there on purpose.)
    if (
      node &&
      !node.deletedAt &&
      !node.archivedAt &&
      node.status === 'growing' &&
      node.priority !== 'shade'
    ) {
      add(node, 'recent');
    }
  }

  // Ambient buckets: shade sorts LAST, never out — "Otra idea" still reaches it.
  const byLightThenFresh = (a: TreeNode, b: TreeNode) => lightRank(a) - lightRank(b) || byFresh(a, b);
  for (const node of all.filter((n) => n.status === 'growing').sort(byLightThenFresh)) add(node, 'fresh-growing');
  for (const node of all.filter((n) => n.status === 'seed').sort(byLightThenFresh)) add(node, 'fresh-seed');

  // «Regadera bajita»: today's energy floats the SMALLEST doors (leaf
  // pasitos — nothing left to decompose) up front. A STABLE partition, not
  // a filter — every idea stays reachable, and the explicit now (today's
  // intentions + cuando-entonces) keeps outranking everything: low energy
  // biases, never tyrannizes (the «luz» guardrails apply verbatim).
  if (energy === 'bajita') {
    const explicit = pool.filter((s) => s.kind === 'today' || s.kind === 'trigger');
    const rest = pool.filter((s) => s.kind !== 'today' && s.kind !== 'trigger');
    // Small = a CHILD leaf (a concrete pasito). A bare TOP-LEVEL goal also
    // has zero children but is the big ambiguous thing — the opposite of a
    // small door.
    const small = rest.filter((s) => s.node.parentId !== null && childrenOf(s.node).length === 0);
    const big = rest.filter((s) => !(s.node.parentId !== null && childrenOf(s.node).length === 0));
    for (const s of small) s.lowEnergy = true;
    return [...explicit, ...small, ...big].slice(0, POOL_CAP);
  }

  return pool.slice(0, POOL_CAP);
}

/** Offset 0 is ALWAYS the ranked best (the reason line stays truthful).
 *  Offsets 1..len-1 walk a permutation seeded by the day — deterministic,
 *  stable within the day, full cycle returns home. */
export function pickAt(pool: Suggestion[], offset: number, dayKey: string): Suggestion | null {
  if (!pool.length) return null;
  const n = ((offset % pool.length) + pool.length) % pool.length;
  if (n === 0 || pool.length === 1) return pool[0];
  return pool[1 + ((hash(dayKey) + n - 1) % (pool.length - 1))];
}

/** Convenience: the single ranked-best suggestion (offset 0). */
export function suggestNext(
  activeTrees: Tree[],
  nodesByTree: ReadonlyMap<string, TreeNode[]>,
  childrenOf: (node: TreeNode) => TreeNode[],
  sessions: TimerSession[],
  checkins: CheckIn[],
  nodesById: ReadonlyMap<string, TreeNode>,
  todayIds: string[] = [],
): Suggestion | null {
  return (
    suggestionPool(activeTrees, nodesByTree, childrenOf, sessions, checkins, nodesById, todayIds)[0] ?? null
  );
}
