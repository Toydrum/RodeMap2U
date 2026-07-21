import { GENERATED_APP_CONFIG } from './generated-config';

export { BACKEND_CONTRACT_SHA256, DEPLOY_STAGE } from './generated-config';

/**
 * Backend wiring: the public APP_CONFIG shape is stable across local and AWS
 * builds. Local development imports the tracked mock-safe generated config.
 * AWS workflows validate the backend contract hash and replace that module in
 * their ephemeral checkout from stage-specific SSM parameters before build.
 *
 * `requireAuth` is false in local/dev and true in test/prod. Network access
 * remains behind the API_CLIENT and AUTH_PROVIDER seams selected at boot.
 */
export const APP_CONFIG = GENERATED_APP_CONFIG;
