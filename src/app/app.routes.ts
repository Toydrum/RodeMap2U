import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsService } from './core/repos/settings.service';

const CHECK_IN_COOLDOWN_MS = 30 * 60 * 1000;

/** Entering the forest asks for a check-in — unless one happened recently. */
const checkInGate: CanActivateFn = () => {
  const settings = inject(SettingsService).settings();
  const router = inject(Router);
  const fresh =
    settings.lastCheckInAt !== null && Date.now() - settings.lastCheckInAt < CHECK_IN_COOLDOWN_MS;
  return fresh ? true : router.createUrlTree(['/check-in']);
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'forest' },
  {
    path: 'check-in',
    loadComponent: () => import('./features/check-in/check-in').then((m) => m.CheckInPage),
    title: 'RodeMap2U',
  },
  {
    path: 'forest',
    canActivate: [checkInGate],
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
  { path: '**', redirectTo: 'forest' },
];
