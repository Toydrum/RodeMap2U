import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { BootService } from './core/boot.service';
import { APP_CONFIG } from './core/config';
import { AUTH_PROVIDER, AuthProvider } from './core/auth/auth-provider';
import { AuthService } from './core/auth/auth.service';
import { API_CLIENT, ApiClient } from './core/api/api-client';
import { lazySeam } from './core/lazy-seam';
import { SyncService } from './core/sync/sync.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => inject(BootService).init()),
    // The mock→AWS flip lives in core/config.ts. BOTH adapter pairs are lazy
    // chunks now (0.0.115 bundle): only the chosen side ever downloads, and
    // even that stays off the first paint — every seam method is async, so
    // lazySeam simply awaits the chunk on the first call.
    {
      provide: AUTH_PROVIDER,
      useFactory: (): AuthProvider =>
        APP_CONFIG.backend === 'aws'
          ? lazySeam(() =>
              import('./core/auth/cognito-auth.provider').then((m) => new m.CognitoAuthProvider()),
            )
          : lazySeam(() =>
              import('./core/auth/mock-auth.provider').then((m) => new m.MockAuthProvider()),
            ),
    },
    {
      provide: API_CLIENT,
      useFactory: (): ApiClient => {
        const auth = inject(AUTH_PROVIDER);
        return APP_CONFIG.backend === 'aws'
          ? lazySeam(() => import('./core/api/http-api').then((m) => new m.HttpApi(auth)))
          : lazySeam(() => import('./core/api/mock-api').then((m) => new m.MockApi(auth)));
      },
    },
    // Parallel to BootService.init(): one meta read, no network — fail-open.
    provideAppInitializer(() => inject(AuthService).hydrate()),
    // Same doctrine: two meta reads; the first pull fires seconds AFTER boot.
    provideAppInitializer(() => inject(SyncService).init()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    // sw.js wraps ngsw-worker.js (importScripts) and adds whisper-tap
    // handling. MUST stay relative — the app lives under /RoadMap2U/.
    provideServiceWorker('sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
