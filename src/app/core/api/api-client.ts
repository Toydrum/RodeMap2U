import { InjectionToken } from '@angular/core';
import { RoadmapApi } from './contracts';

/**
 * The data seam. Same shape as the backend contract; two implementations
 * chosen at boot by APP_CONFIG.backend: MockApi (executable spec over the
 * on-device mock cloud) and HttpApi (fetch → API Gateway with bearer tokens).
 * Feature services inject API_CLIENT — nothing outside core/api touches
 * fetch or endpoint paths.
 */
export type ApiClient = RoadmapApi;

export const API_CLIENT = new InjectionToken<ApiClient>('API_CLIENT');
