import { AuthProvider } from './auth-provider';
import {
  AuthError,
  AuthNext,
  AuthSession,
  passwordMeetsPolicy,
  USERNAME_PATTERN,
} from './auth-types';
import {
  MockCredentialRow,
  MockUserRow,
  mockDelete,
  mockGet,
  mockPut,
  simLatency,
} from '../api/mock-cloud';

/**
 * Cognito, simulated — same challenges, same error vocabulary, zero network.
 * Deterministic on purpose: the confirmation code is ALWAYS 123456, seeded
 * demo passwords live in mock-seed.ts, and tokens are unsigned JWT-SHAPED
 * strings in localStorage (1 h exp, free "refresh") so the bearer plumbing the
 * real backend needs is rehearsed end to end. Works fully offline.
 */

const TOKEN_KEY = 'rm2u.mock.idToken';
const TOKEN_TTL_MS = 60 * 60 * 1000;
const MOCK_CODE = '123456';

interface MockTokenPayload {
  sub: string;
  username: string;
  'custom:accountType': string;
  iat: number;
  exp: number;
}

function mintToken(user: MockUserRow, now = Date.now()): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  // ASCII-safe by construction: username is [a-z0-9_], no display text here.
  const payload = btoa(
    JSON.stringify({
      sub: user.userId,
      username: user.username,
      'custom:accountType': user.accountType,
      iat: now,
      exp: now + TOKEN_TTL_MS,
    } satisfies MockTokenPayload),
  );
  return `${header}.${payload}.mock`;
}

export function parseMockToken(token: string): MockTokenPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as MockTokenPayload;
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0] ?? '?'}***@${domain?.[0] ?? '?'}***`;
}

export class MockAuthProvider implements AuthProvider {
  /** Username mid-newPasswordRequired — in memory only, like Cognito's flow. */
  private pendingChallenge: string | null = null;

  async signIn(username: string, password: string): Promise<AuthNext> {
    await simLatency('auth.signIn');
    const handle = username.trim().toLowerCase();
    const cred = await mockGet<MockCredentialRow>('credentials', handle);
    if (!cred) throw new AuthError('userNotFound');
    if (cred.password !== password) throw new AuthError('wrongCredentials');
    const user = await this.userOf(cred.userId);
    if (cred.pendingConfirm) {
      return {
        kind: 'confirmSignUp',
        username: handle,
        deliveryHint: user.email ? maskEmail(user.email) : null,
      };
    }
    if (cred.mustChangePassword) {
      this.pendingChallenge = handle;
      return { kind: 'newPasswordRequired' };
    }
    return this.establish(user);
  }

  async signUp(input: {
    username: string;
    password: string;
    email: string;
    displayName: string;
  }): Promise<AuthNext> {
    await simLatency('auth.signUp');
    const handle = input.username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(handle)) throw new AuthError('unknown', 'invalid username');
    if (!passwordMeetsPolicy(input.password)) throw new AuthError('passwordPolicy');
    if (await mockGet<MockCredentialRow>('credentials', handle)) {
      throw new AuthError('userExists');
    }
    const user: MockUserRow = {
      userId: `u-${handle}`,
      username: handle,
      displayName: input.displayName.trim() || handle,
      accountType: 'adult', // minors never self-sign-up; guardians create them
      socialEnabled: true,
      createdAt: Date.now(),
      email: input.email.trim(),
    };
    await mockPut('users', user);
    await mockPut('credentials', {
      username: handle,
      userId: user.userId,
      password: input.password,
      mustChangePassword: false,
      pendingConfirm: true,
    } satisfies MockCredentialRow);
    return { kind: 'confirmSignUp', username: handle, deliveryHint: maskEmail(user.email!) };
  }

  async confirmSignUp(username: string, code: string): Promise<void> {
    await simLatency('auth.confirmSignUp');
    const cred = await mockGet<MockCredentialRow>('credentials', username.trim().toLowerCase());
    if (!cred) throw new AuthError('userNotFound');
    if (code.trim() !== MOCK_CODE) throw new AuthError('codeMismatch');
    await mockPut('credentials', { ...cred, pendingConfirm: false });
  }

  async resendCode(username: string): Promise<void> {
    await simLatency('auth.resendCode');
    const cred = await mockGet<MockCredentialRow>('credentials', username.trim().toLowerCase());
    if (!cred) throw new AuthError('userNotFound');
    // The mock "sends" nothing — the code is always 123456.
  }

  async completeNewPassword(newPassword: string): Promise<AuthNext> {
    await simLatency('auth.completeNewPassword');
    if (!this.pendingChallenge) throw new AuthError('unknown', 'no pending challenge');
    if (!passwordMeetsPolicy(newPassword)) throw new AuthError('passwordPolicy');
    const cred = await mockGet<MockCredentialRow>('credentials', this.pendingChallenge);
    if (!cred) throw new AuthError('userNotFound');
    await mockPut('credentials', { ...cred, password: newPassword, mustChangePassword: false });
    this.pendingChallenge = null;
    return this.establish(await this.userOf(cred.userId));
  }

  async forgotPassword(username: string): Promise<{ deliveryHint: string | null }> {
    await simLatency('auth.forgotPassword');
    const cred = await mockGet<MockCredentialRow>('credentials', username.trim().toLowerCase());
    if (!cred) throw new AuthError('userNotFound');
    const user = await this.userOf(cred.userId);
    if (!user.email) {
      // Username-only minors recover through their guardian, never a code.
      throw new AuthError('unknown', 'no recovery email on this account');
    }
    return { deliveryHint: maskEmail(user.email) };
  }

  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void> {
    await simLatency('auth.confirmForgotPassword');
    const cred = await mockGet<MockCredentialRow>('credentials', username.trim().toLowerCase());
    if (!cred) throw new AuthError('userNotFound');
    if (code.trim() !== MOCK_CODE) throw new AuthError('codeMismatch');
    if (!passwordMeetsPolicy(newPassword)) throw new AuthError('passwordPolicy');
    await mockPut('credentials', { ...cred, password: newPassword, mustChangePassword: false });
  }

  async signOut(): Promise<void> {
    await simLatency('auth.signOut');
    localStorage.removeItem(TOKEN_KEY);
    this.pendingChallenge = null;
  }

  async currentSession(): Promise<AuthSession | null> {
    const token = await this.liveToken(false);
    if (!token) return null;
    const payload = parseMockToken(token)!;
    const user = await mockGet<MockUserRow>('users', payload.sub);
    if (!user) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return this.sessionOf(user);
  }

  async idToken(opts?: { forceRefresh?: boolean }): Promise<string | null> {
    return this.liveToken(opts?.forceRefresh ?? false);
  }

  async deleteAccount(): Promise<void> {
    await simLatency('auth.deleteAccount');
    const token = await this.liveToken(false);
    const payload = token ? parseMockToken(token) : null;
    if (!payload) throw new AuthError('unknown', 'not signed in');
    // Links/friendships/cloud records cascade when the familia phase defines
    // the server-side rules; identity removal is enough to rehearse the flow.
    await mockDelete('credentials', payload.username);
    await mockDelete('users', payload.sub);
    localStorage.removeItem(TOKEN_KEY);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Valid token or null; expired tokens re-mint freely (mock refresh). */
  private async liveToken(forceRefresh: boolean): Promise<string | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const payload = parseMockToken(token);
    if (!payload) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    if (!forceRefresh && payload.exp > Date.now()) return token;
    const user = await mockGet<MockUserRow>('users', payload.sub);
    if (!user) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    const fresh = mintToken(user);
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  }

  private async userOf(userId: string): Promise<MockUserRow> {
    const user = await mockGet<MockUserRow>('users', userId);
    if (!user) throw new AuthError('userNotFound');
    return user;
  }

  private sessionOf(user: MockUserRow): AuthSession {
    return {
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        accountType: user.accountType,
      },
      issuedAt: Date.now(),
    };
  }

  private establish(user: MockUserRow): AuthNext {
    localStorage.setItem(TOKEN_KEY, mintToken(user));
    return { kind: 'done', session: this.sessionOf(user) };
  }
}
