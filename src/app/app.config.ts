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
import { AUTH_PROVIDER } from './core/auth/auth-provider';
import { AuthService } from './core/auth/auth.service';
import { CognitoAuthProvider } from './core/auth/cognito-auth.provider';
import { MockAuthProvider } from './core/auth/mock-auth.provider';
import { API_CLIENT } from './core/api/api-client';
import { HttpApi } from './core/api/http-api';
import { MockApi } from './core/api/mock-api';
import { SyncService } from './core/sync/sync.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => inject(BootService).init()),
    // The mock→AWS flip lives in core/config.ts; both real adapters stay
    // dormant (and amplify stays a lazy chunk) until backend === 'aws'.
    {
      provide: AUTH_PROVIDER,
      useFactory: () =>
        APP_CONFIG.backend === 'aws' ? new CognitoAuthProvider() : new MockAuthProvider(),
    },
    {
      provide: API_CLIENT,
      useFactory: () => {
        const auth = inject(AUTH_PROVIDER);
        return APP_CONFIG.backend === 'aws' ? new HttpApi(auth) : new MockApi(auth);
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
