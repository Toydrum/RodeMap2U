/**
 * Backend wiring — the entire mock→AWS migration lives in this file.
 *
 * While `backend` is 'mock', auth and API run against the on-device simulated
 * cloud (`core/api/mock-cloud.ts`) and the app never touches the network.
 * Go-live day: deploy `infra/` (CDK stack outputs print these exact strings),
 * paste them below, flip `backend` to 'aws', bump the version, push.
 *
 * `requireAuth` stays false until AFTER the connect-my-forest flow ships
 * (owner decision 2026-07-06: login becomes mandatory at AWS go-live, not
 * while the backend is simulated). The gate itself is already wired on every
 * route — flipping this boolean activates it.
 */
export const APP_CONFIG = Object.freeze({
  backend: 'mock' as 'mock' | 'aws',
  requireAuth: false,
  aws: Object.freeze({
    region: '',
    userPoolId: '',
    userPoolClientId: '',
    apiBaseUrl: '',
  }),
});
