import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { APP_CONFIG } from '../config';
import { AuthService } from './auth.service';

/**
 * The future mandatory-login gate — wired on every route except /account,
 * INERT until APP_CONFIG.requireAuth flips true at AWS go-live (owner
 * decision 2026-07-06). `volver` brings the user back where they were headed;
 * query params survive the GH Pages 404.html fallback.
 */
export const authRequiredGate: CanActivateFn = (_route, state) => {
  if (!APP_CONFIG.requireAuth) return true;
  if (inject(AuthService).status() === 'signedIn') return true;
  return inject(Router).createUrlTree(['/account'], { queryParams: { volver: state.url } });
};
