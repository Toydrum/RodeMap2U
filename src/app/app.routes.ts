import { Routes } from '@angular/router';
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsService } from './core/repos/settings.service';

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

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ahora' },
  {
    path: 'check-in',
    loadComponent: () => import('./features/check-in/check-in').then((m) => m.CheckInPage),
    title: 'RodeMap2U',
  },
  {
    path: 'ahora',
    canActivate: [checkInGate],
    loadComponent: () => import('./features/ahora/ahora').then((m) => m.AhoraPage),
    title: 'RodeMap2U — Ahora',
  },
  {
    path: 'forest',
    loadComponent: () => import('./features/forest/forest').then((m) => m.ForestPage),
    title: 'RodeMap2U — Mi bosque',
  },
  {
    path: 'tree/:id',
    loadComponent: () => import('./features/forest/tree-view').then((m) => m.TreeViewPage),
    title: 'RodeMap2U',
  },
  {
    path: 'timer',
    loadComponent: () => import('./features/timer/timer').then((m) => m.TimerPage),
    title: 'RodeMap2U — Enfoque',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
    title: 'RodeMap2U — Ajustes',
  },
  {
    path: 'guide',
    loadComponent: () => import('./features/guide/guide').then((m) => m.GuidePage),
    title: 'RodeMap2U — Guía',
  },
  {
    path: 'trail',
    loadComponent: () => import('./features/trail/trail').then((m) => m.TrailPage),
    title: 'RodeMap2U — Huellas',
  },
  { path: '**', redirectTo: 'ahora' },
];
