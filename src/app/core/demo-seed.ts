import { CheckIn, Settings, TimerSession, Tree, TreeNode } from './db/schema';

/**
 * Demo forest for `?seed=demo`: fixed ids so routes are predictable
 * (/tree/demo-guitar), a bit of every status, one branched story.
 * Loaded only when the store is empty — never touches real data.
 */

const now = Date.now();
const day = 86_400_000;

function dateOnly(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Yesterday — so demos showcase the gentle date-review conversation. */
const yesterday = dateOnly(now - day);

function base(id: string, offsetDays: number) {
  return {
    id,
    createdAt: now - offsetDays * day,
    updatedAt: now - offsetDays * day,
    rev: 1,
    deletedAt: null,
  };
}

export const DEMO_TREES: Tree[] = [
  { ...base('demo-guitar', 40), name: 'Aprender guitarra', accent: 'moss', order: 10, currentNodeId: 'demo-g-first-song', archivedAt: null },
  { ...base('demo-health', 30), name: 'Cuidarme', accent: 'rose', order: 20, currentNodeId: null, archivedAt: null },
  { ...base('demo-work', 20), name: 'Proyecto personal', accent: 'sky', order: 30, currentNodeId: null, archivedAt: null },
  { ...base('demo-seedling', 10), name: 'Idea nueva', accent: 'clay', order: 40, currentNodeId: null, archivedAt: null },
];

function node(
  id: string,
  treeId: string,
  parentId: string | null,
  title: string,
  status: TreeNode['status'],
  order: number,
  extra: Partial<TreeNode> = {},
): TreeNode {
  return {
    ...base(id, 25),
    treeId,
    parentId,
    title,
    note: '',
    status,
    order,
    targetDate: null,
    achievedAt: status === 'achieved' ? now - 3 * day : null,
    branchedAt: status === 'branched' ? now - 6 * day : null,
    origin: 'planned',
    archivedAt: null,
    ...extra,
  };
}

export const DEMO_NODES: TreeNode[] = [
  // Guitar tree — a real story: roots, blooms, a branch point with alternatives
  node('demo-g-root', 'demo-guitar', null, 'Tocar guitarra', 'growing', 10),
  node('demo-g-buy', 'demo-guitar', 'demo-g-root', 'Conseguir una guitarra', 'achieved', 10),
  node('demo-g-chords', 'demo-guitar', 'demo-g-root', 'Primeros 4 acordes', 'achieved', 20, {
    note: 'El Fa me costó dos semanas — y salió.',
  }),
  node('demo-g-daily', 'demo-guitar', 'demo-g-root', 'Practicar diario 30 min', 'branched', 30),
  node('demo-g-mini', 'demo-guitar', 'demo-g-daily', '10 min al despertar', 'growing', 10, {
    origin: 'branch',
    note: 'Con la guitarra a la vista es más fácil.',
  }),
  node('demo-g-weekend', 'demo-guitar', 'demo-g-daily', 'Sesión larga los sábados', 'seed', 20, { origin: 'branch' }),
  node('demo-g-first-song', 'demo-guitar', 'demo-g-chords', 'Mi primera canción completa', 'growing', 10),
  node('demo-g-record', 'demo-guitar', 'demo-g-first-song', 'Grabarme y escucharme', 'seed', 10),

  // Health tree — gentler, smaller
  node('demo-h-root', 'demo-health', null, 'Sentirme mejor', 'growing', 10),
  node('demo-h-walk', 'demo-health', 'demo-h-root', 'Caminar 3 veces por semana', 'growing', 10, { targetDate: yesterday }),
  node('demo-h-sleep', 'demo-health', 'demo-h-root', 'Dormir antes de las 12', 'resting', 20),
  node('demo-h-water', 'demo-health', 'demo-h-walk', 'Llevar botella de agua', 'achieved', 10),

  // Work tree — young, with one branch asleep long enough to appear
  // in the trail's "Ramas dormidas" section (dormant = 30+ quiet days).
  node('demo-w-root', 'demo-work', null, 'Lanzar mi proyecto', 'seed', 10),
  node('demo-w-idea', 'demo-work', 'demo-w-root', 'Aterrizar la idea en una página', 'growing', 10, {
    createdAt: now - 45 * day,
    updatedAt: now - 45 * day,
  }),

  // Single-branch baby tree (sapling rendering check)
  node('demo-s-root', 'demo-seedling', null, 'Explorar esta idea', 'seed', 10),
];

export const DEMO_CHECKINS: CheckIn[] = [
  { ...base('demo-checkin-1', 1), feeling: 'calm', note: 'Un día tranquilo', treeId: 'demo-guitar', nodeId: 'demo-g-first-song' },
  { ...base('demo-checkin-2', 3), feeling: 'foggy', note: 'La niebla también pasa', treeId: null, nodeId: null },
];

export const DEMO_SESSIONS: TimerSession[] = [
  { ...base('demo-session-1', 2), nodeId: 'demo-g-first-song', startedAt: now - 2 * day, plannedMinutes: 25, endedAt: now - 2 * day + 22 * 60_000, note: '' },
];

export const DEMO_SETTINGS_PATCH: Partial<Settings> = {
  lastCheckInAt: now,
  onboarded: true,
};
