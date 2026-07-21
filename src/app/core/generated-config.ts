/**
 * Safe tracked default for local development and CI.
 * AWS deployment workflows replace this file in their ephemeral checkout.
 */
export const DEPLOY_STAGE = 'local' as const;
export const BACKEND_CONTRACT_SHA256 = 'mock';

export const GENERATED_APP_CONFIG = Object.freeze({
  backend: 'mock' as 'mock' | 'aws',
  requireAuth: false,
  aws: Object.freeze({
    region: '',
    userPoolId: '',
    userPoolClientId: '',
    apiBaseUrl: '',
  }),
});
