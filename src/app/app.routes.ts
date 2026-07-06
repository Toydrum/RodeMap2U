import { Routes } from '@angular/router';
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsService } from './core/repos/settings.service';
import { authRequiredGate } from './core/auth/auth.guard';
import { VisitSession } from './core/visit/visit-session';
import { VisitNodesRepo, VisitTreesRepo } from './core/visit/visit-repos';
import { TreesRepo } from './core/repos/trees.repo';
import { NodesRepo } from './core/repos/nodes.repo';

/** Loads the visited forest before the subtree paints (idempotent per user). */
const visitGate: CanActivateFn = (route) => {
  const userId = route.paramMap.get('userId') ?? '';
  return inject(VisitSession)
    .load(userId)
    .then(() => true);
};

const CHECK_IN_COOLDOWN_MS = 30 * 60 * 1000;

/** One gentle diversion per app-open. After that, tabs go exactly where they say. */
@Injectable({ providedIn: 'root' })
export class SessionGate {
  consumed = false;
}

/** The FIRST Ahora visit of an app-open may ask for a check-in (respecting
 *  the cooldown). Later tab taps never divert — the rose is the way back in.
 *  The ritual exits back onto /ahora, which then passes (consumed is set
 *  BEFORE the redirect, so no loop is possible). */
const checkInGate: CanActivateFn = () => {
  const gate = inject(SessionGate);
  if (gate.consumed) return true;
  gate.consumed = true;
  const settings = inject(SettingsService).settings();
  const fresh =
    settings.lastCheckInAt !== null && Date.now() - settings.lastCheckInAt < CHECK_IN_COOLDOWN_MS;
  return fresh ? true : inject(Router).createUrlTree(['/check-in']);
};

// authRequiredGate guards every route EXCEPT /account. It is inert until
// APP_CONFIG.requireAuth flips true at AWS go-live — see core/auth/auth.guard.ts.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ahora' },
  {
    path: 'check-in',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/check-in/check-in').then((m) => m.CheckInPage),
    title: 'RoadMap2U',
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account').then((m) => m.AccountPage),
    title: 'RoadMap2U — Cuenta',
  },
  {
    path: 'ahora',
    canActivate: [authRequiredGate, checkInGate],
    loadComponent: () => import('./features/ahora/ahora').then((m) => m.AhoraPage),
    title: 'RoadMap2U — Ahora',
  },
  {
    path: 'forest',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/forest/forest').then((m) => m.ForestPage),
    title: 'RoadMap2U — Mi bosque',
  },
  {
    path: 'tree/:id',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/forest/tree-view').then((m) => m.TreeViewPage),
    title: 'RoadMap2U',
  },
  {
    path: 'timer',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/timer/timer').then((m) => m.TimerPage),
    title: 'RoadMap2U — Enfoque',
  },
  {
    // Someone else's forest: route-scoped repos shadow the real ones, so the
    // whole tree toolkit reads/writes the VISITED forest (cloud write-through)
    // and never the visitor's local IndexedDB. See core/visit/.
    path: 'visit/:userId',
    canActivate: [authRequiredGate, visitGate],
    providers: [
      VisitSession,
      VisitTreesRepo,
      VisitNodesRepo,
      { provide: TreesRepo, useExisting: VisitTreesRepo },
      { provide: NodesRepo, useExisting: VisitNodesRepo },
    ],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/visit/visit-forest').then((m) => m.VisitForestPage),
        title: 'RoadMap2U — De visita',
      },
      {
        path: 'tree/:id',
        loadComponent: () => import('./features/forest/tree-view').then((m) => m.TreeViewPage),
        title: 'RoadMap2U — De visita',
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
    title: 'RoadMap2U — Ajustes',
  },
  {
    path: 'guide',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/guide/guide').then((m) => m.GuidePage),
    title: 'RoadMap2U — Guía',
  },
  {
    path: 'trail',
    canActivate: [authRequiredGate],
    loadComponent: () => import('./features/trail/trail').then((m) => m.TrailPage),
    title: 'RoadMap2U — Huellas',
  },
  { path: '**', redirectTo: 'ahora' },
];
