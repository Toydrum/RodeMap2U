import { describe, expect, it } from 'vitest';

import { ApiError } from './contracts';
import { assertSocialEnabled } from './mock-api';

describe('assertSocialEnabled', () => {
  it('allows social operations only when the caller enabled them', () => {
    expect(() => assertSocialEnabled({ socialEnabled: true })).not.toThrow();

    try {
      assertSocialEnabled({ socialEnabled: false });
      throw new Error('expected assertSocialEnabled to reject the caller');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('FORBIDDEN');
    }
  });
});
