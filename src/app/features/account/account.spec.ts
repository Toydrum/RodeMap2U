import { describe, expect, it } from 'vitest';

import { createAccountInputError, normalizedUsername } from './account';

describe('account create validation', () => {
  it('normalizes username case before signup', () => {
    expect(normalizedUsername(' LynxPardelle ')).toBe('lynxpardelle');
  });

  it('rejects spaces in usernames before Cognito', () => {
    expect(
      createAccountInputError('Lynx Pardelle', 'lnxdrk@gmail.com', 'Abc12345', 'Abc12345'),
    ).toBe('invalidUsername');
  });

  it('rejects missing email before Cognito', () => {
    expect(createAccountInputError('lynxpardelle', '', 'Abc12345', 'Abc12345')).toBe(
      'invalidEmail',
    );
  });
});
