import { CheckIn, Tree, TreeNode } from '../../core/db/schema';
import { dayOf, isPast } from '../../core/time';

/**
 * «El almanaque» — the PURE time lens (0.0.81). Sister of suggest.ts and
 * tree-labels.ts: no Angular, fully vitest-able. It never schedules and it
 * never ranks — it only arranges what already happened (flowers, knots,
 * footprints) and what wants to come (capullos) onto days.
 *
 * The golden rule, as the owner decided it: the past shows what OCCURRED
 * (a flower on its achievedAt day, a golden knot on its branchedAt day),
 * and a passed-unresolved fecha amable stays visible on ITS day as a
 * capullo wearing a soft 🍂 — never red, never "atrasado", always a door
 * to the same dignified conversation.
 *
 * Senderos (repeatsDaily step paths) leave NO month marks: their morning
 * sweep erases yesterday's blooms by design, so painting them would show
 * history that vanishes overnight — the opposite of predictability. They
 * live only in «el caminito de hoy».
 */

/** One cell of the month grid. */
export interface AlmanacCell {
  /** 'YYYY-MM-DD' local date key. */
  date: string;
  /** False for the leading/trailing days that pad the first/last week. */
  inMonth: boolean;
}

/** A dated branch (capullo) waiting on a day. */
export interface DatedBranch {
  node: TreeNode;
  tree: Tree;
  /** The fecha amable already passed unresolved — wears the soft 🍂. */
  passed: boolean;
}

export interface BloomMark {
  node: TreeNode;
  tree: Tree;
}

/** Everything a single day holds. */
export interface DayMarks {
  capullos: DatedBranch[];
  flowers: BloomMark[];
  knots: BloomMark[];
  hasCheckin: boolean;
}

/** «Lo que se acerca» — a coming fecha amable, in soft words. */
export interface UpcomingDate {
  node: TreeNode;
  tree: Tree;
  when: 'tomorrow' | 'days' | 'week' | 'later';
}

/** One sendero rendered as today's stone path. */
export interface Caminito {
  parent: TreeNode;
  tree: Tree;
  steps: TreeNode[];
  /** The first unbloomed stone — the TEACCH «siguiente». Null = all bloomed. */
  nextId: string | null;
}

/** Month grid as full weeks (rows of 7), padded with out-of-month cells.
 *  `month` is 1-based. `weekStart` 1 = Monday (es), 0 = Sunday (en). */
export function monthMatrix(year: number, month: number, weekStart: 0 | 1 = 1): AlmanacCell[][] {
  const key = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const lead = (firstWeekday - weekStart + 7) % 7;

  const cells: AlmanacCell[] = [];
  // Leading pad from the previous month.
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevDays = new Date(prevYear, prevMonth, 0).getDate();
  for (let i = lead - 1; i >= 0; i--) {
    cells.push({ date: key(prevYear, prevMonth, prevDays - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: key(year, month, d), inMonth: true });
  }
  // Trailing pad to complete the last week.
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let d = 1; cells.length % 7 !== 0; d++) {
    cells.push({ date: key(nextYear, nextMonth, d), inMonth: false });
  }

  const weeks: AlmanacCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Ids of every sendero step — excluded from ALL month marks (see header). */
export function senderoStepIds(
  trees: Tree[],
  nodesByTree: Map<string, TreeNode[]>,
): Set<string> {
  const ids = new Set<string>();
  for (const tree of trees) {
    for (const node of nodesByTree.get(tree.id) ?? []) {
      if (!(node.repeatsDaily && node.flow === 'steps')) continue;
      for (const child of nodesByTree.get(tree.id) ?? []) {
        if (child.parentId === node.id) ids.add(child.id);
      }
    }
  }
  return ids;
}

/** Every day's marks, keyed 'YYYY-MM-DD'. Feed it live data only
 *  (`trees.active()` + each tree's visible nodes — the two-layer law). */
export function marksFor(
  trees: Tree[],
  nodesByTree: Map<string, TreeNode[]>,
  checkins: CheckIn[],
  today: string,
): Map<string, DayMarks> {
  const marks = new Map<string, DayMarks>();
  const at = (date: string): DayMarks => {
    let m = marks.get(date);
    if (!m) {
      m = { capullos: [], flowers: [], knots: [], hasCheckin: false };
      marks.set(date, m);
    }
    return m;
  };
  const excluded = senderoStepIds(trees, nodesByTree);

  for (const tree of trees) {
    for (const node of nodesByTree.get(tree.id) ?? []) {
      if (excluded.has(node.id)) continue;
      // Capullos: live branches with a fecha amable, on that date — passed
      // ones stay on THEIR day (owner rule: predictability over hiding).
      if (
        node.targetDate !== null &&
        (node.status === 'seed' || node.status === 'growing' || node.status === 'resting')
      ) {
        at(node.targetDate).capullos.push({ node, tree, passed: node.targetDate < today });
      }
      // Flowers: the day a bloom actually opened.
      if (node.achievedAt) at(dayOf(node.achievedAt)).flowers.push({ node, tree });
      // Golden knots: the day a branch transformed into new paths.
      if (node.branchedAt && node.status === 'branched') {
        at(dayOf(node.branchedAt)).knots.push({ node, tree });
      }
    }
  }

  for (const checkin of checkins) {
    at(dayOf(checkin.createdAt)).hasCheckin = true;
  }

  return marks;
}

/** The next few fechas amables, in soft words — never a countdown. */
export function upcoming(
  trees: Tree[],
  nodesByTree: Map<string, TreeNode[]>,
  today: string,
  cap = 3,
): UpcomingDate[] {
  const out: { entry: UpcomingDate; date: string }[] = [];
  const excluded = senderoStepIds(trees, nodesByTree);
  for (const tree of trees) {
    for (const node of nodesByTree.get(tree.id) ?? []) {
      if (excluded.has(node.id)) continue;
      if (node.targetDate === null || node.targetDate <= today) continue;
      if (node.status !== 'seed' && node.status !== 'growing' && node.status !== 'resting') continue;
      out.push({ entry: { node, tree, when: whenWord(today, node.targetDate) }, date: node.targetDate });
    }
  }
  return out
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.entry.node.id < b.entry.node.id ? -1 : 1))
    .slice(0, cap)
    .map((o) => o.entry);
}

/** Word distance for a FUTURE date: mañana / en unos días / la próxima
 *  semana / más adelante. Words, never numbers — counters escalate. */
export function whenWord(today: string, date: string): UpcomingDate['when'] {
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d, 12) - Date.UTC(ty, tm - 1, td, 12)) / 86_400_000);
  if (days <= 1) return 'tomorrow';
  if (days <= 6) return 'days';
  if (days <= 13) return 'week';
  return 'later';
}

/** Today's stone paths: every live sendero, steps in walking order. */
export function caminitos(
  trees: Tree[],
  nodesByTree: Map<string, TreeNode[]>,
): Caminito[] {
  const out: Caminito[] = [];
  for (const tree of trees) {
    const nodes = nodesByTree.get(tree.id) ?? [];
    for (const parent of nodes) {
      if (!(parent.repeatsDaily && parent.flow === 'steps' && parent.status !== 'branched')) continue;
      const steps = nodes
        .filter((n) => n.parentId === parent.id)
        .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
      if (!steps.length) continue;
      const next = steps.find((s) => s.status === 'seed' || s.status === 'growing');
      out.push({ parent, tree, steps, nextId: next?.id ?? null });
    }
  }
  return out;
}
