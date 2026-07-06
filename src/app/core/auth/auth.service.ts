import { Injectable, inject, signal } from '@angular/core';
import { AUTH_PROVIDER } from './auth-provider';
import {
  AuthError,
  AuthErrorCode,
  AuthIdentitySnapshot,
  AuthNext,
  AuthSession,
  AuthUser,
  META_AUTH_IDENTITY,
} from './auth-types';
import { get, put } from '../db/idb';

/**
 * The app-facing identity facade — components talk to these signals, never to
 * a provider or an exception. Every flow method converts thrown AuthErrors
 * into `lastError` values and challenge steps into the `challenge` signal.
 *
 * Boot doctrine (fail-open, like BootService): `hydrate()` reads ONE meta key
 * and never touches the network or the auth SDK — an offline PWA start shows
 * the cached identity instantly. Validation happens in the background later;
 * a definitively-dead session sets `sessionStale` instead of silently
 * demoting to guest (re-auth is only demanded when a cloud feature needs it).
 */

export type AuthFlowResult = 'done' | 'confirmSignUp' | 'newPasswordRequired' | 'error';

const AUTH_CHANNEL = 'rodemap2u-auth';
const VALIDATE_DELAY_MS = 4000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly provider = inject(AUTH_PROVIDER);

  private readonly statusSignal = signal<'guest' | 'signedIn'>('guest');
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly busySignal = signal(false);
  private readonly lastErrorSignal = signal<AuthErrorCode | null>(null);
  private readonly challengeSignal = signal<'confirmSignUp' | 'newPasswordRequired' | null>(null);
  private readonly sessionStaleSignal = signal(false);
  private readonly deliveryHintSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly challenge = this.challengeSignal.asReadonly();
  readonly sessionStale = this.sessionStaleSignal.asReadonly();
  /** Masked destination of the last emailed code ("r***@d***"). */
  readonly deliveryHint = this.deliveryHintSignal.asReadonly();

  /** Username the current challenge/recovery flow is about. */
  private pendingUsername: string | null = null;
  /** Credentials held IN MEMORY for the sign-up → confirm → sign-in hop only. */
  private heldCredentials: { username: string; password: string } | null = null;

  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTH_CHANNEL) : null;

  /** App initializer — one IDB read, zero network, any failure ⇒ guest. */
  async hydrate(): Promise<void> {
    try {
      const snapshot = await get<AuthIdentitySnapshot>('meta', META_AUTH_IDENTITY);
      if (snapshot?.user) {
        this.userSignal.set(snapshot.user);
        this.statusSignal.set('signedIn');
      }
    } catch {
      // Storage unavailable — the session runs as guest.
    }

    this.channel?.addEventListener('message', () => void this.mirrorFromMeta());

    // Background validation — never at boot, never offline, never blocking.
    setTimeout(() => void this.validateQuietly(), VALIDATE_DELAY_MS);
  }

  async signIn(username: string, password: string): Promise<AuthFlowResult> {
    return this.run(async () => {
      const next = await this.provider.signIn(username, password);
      // Held only while a confirm step might need to finish the sign-in.
      this.heldCredentials = { username, password };
      return this.applyNext(next);
    });
  }

  async signUp(input: {
    username: string;
    password: string;
    email: string;
    displayName: string;
  }): Promise<AuthFlowResult> {
    return this.run(async () => {
      const next = await this.provider.signUp(input);
      this.heldCredentials = { username: input.username, password: input.password };
      return this.applyNext(next);
    });
  }

  /** Finishes confirmSignUp; if we hold credentials, completes the sign-in. */
  async confirmCode(code: string): Promise<AuthFlowResult> {
    return this.run(async () => {
      if (!this.pendingUsername) throw new AuthError('unknown', 'no pending confirmation');
      await this.provider.confirmSignUp(this.pendingUsername, code);
      if (this.heldCredentials) {
        const next = await this.provider.signIn(
          this.heldCredentials.username,
          this.heldCredentials.password,
        );
        return this.applyNext(next);
      }
      this.challengeSignal.set(null);
      return 'done';
    });
  }

  async resendCode(): Promise<AuthFlowResult> {
    return this.run(async () => {
      if (!this.pendingUsername) throw new AuthError('unknown', 'no pending confirmation');
      await this.provider.resendCode(this.pendingUsername);
      return 'done';
    });
  }

  async completeNewPassword(newPassword: string): Promise<AuthFlowResult> {
    return this.run(async () => this.applyNext(await this.provider.completeNewPassword(newPassword)));
  }

  async forgotPassword(username: string): Promise<AuthFlowResult> {
    return this.run(async () => {
      const { deliveryHint } = await this.provider.forgotPassword(username);
      this.pendingUsername = username;
      this.deliveryHintSignal.set(deliveryHint);
      return 'done';
    });
  }

  async confirmForgotPassword(code: string, newPassword: string): Promise<AuthFlowResult> {
    return this.run(async () => {
      if (!this.pendingUsername) throw new AuthError('unknown', 'no pending recovery');
      await this.provider.confirmForgotPassword(this.pendingUsername, code, newPassword);
      return 'done';
    });
  }

  /** Clears identity only — local forests are NEVER touched by sign-out. */
  async signOut(): Promise<void> {
    try {
      await this.provider.signOut();
    } catch {
      // Provider hiccups must not trap the user in a session.
    }
    await this.clearIdentity();
  }

  async deleteAccount(): Promise<AuthFlowResult> {
    const result = await this.run(async () => {
      await this.provider.deleteAccount();
      return 'done' as const;
    });
    if (result === 'done') await this.clearIdentity();
    return result;
  }

  /** Leaves a challenge flow without finishing it (UI "volver"). */
  dismissChallenge(): void {
    this.challengeSignal.set(null);
    this.lastErrorSignal.set(null);
    this.heldCredentials = null;
    this.pendingUsername = null;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async run(flow: () => Promise<AuthFlowResult>): Promise<AuthFlowResult> {
    this.busySignal.set(true);
    this.lastErrorSignal.set(null);
    try {
      return await flow();
    } catch (error) {
      this.lastErrorSignal.set(error instanceof AuthError ? error.code : 'unknown');
      return 'error';
    } finally {
      this.busySignal.set(false);
    }
  }

  private applyNext(next: AuthNext): AuthFlowResult {
    if (next.kind === 'done') {
      void this.commit(next.session);
      return 'done';
    }
    if (next.kind === 'confirmSignUp') {
      this.pendingUsername = next.username;
      this.deliveryHintSignal.set(next.deliveryHint);
      this.challengeSignal.set('confirmSignUp');
      return 'confirmSignUp';
    }
    this.challengeSignal.set('newPasswordRequired');
    return 'newPasswordRequired';
  }

  private async commit(session: AuthSession): Promise<void> {
    this.userSignal.set(session.user);
    this.statusSignal.set('signedIn');
    this.challengeSignal.set(null);
    this.sessionStaleSignal.set(false);
    this.heldCredentials = null;
    this.pendingUsername = null;
    try {
      await put('meta', {
        key: META_AUTH_IDENTITY,
        user: session.user,
        cachedAt: Date.now(),
      } satisfies AuthIdentitySnapshot);
    } catch {
      // Memory-only session — identity still works until the app closes.
    }
    this.channel?.postMessage('changed');
  }

  private async clearIdentity(): Promise<void> {
    this.userSignal.set(null);
    this.statusSignal.set('guest');
    this.challengeSignal.set(null);
    this.sessionStaleSignal.set(false);
    this.heldCredentials = null;
    this.pendingUsername = null;
    try {
      await put('meta', { key: META_AUTH_IDENTITY, user: null, cachedAt: Date.now() });
    } catch {
      /* nothing to clear */
    }
    this.channel?.postMessage('changed');
  }

  /** Another tab signed in/out — mirror whatever meta now says. */
  private async mirrorFromMeta(): Promise<void> {
    try {
      const snapshot = await get<AuthIdentitySnapshot>('meta', META_AUTH_IDENTITY);
      if (snapshot?.user) {
        this.userSignal.set(snapshot.user);
        this.statusSignal.set('signedIn');
      } else {
        this.userSignal.set(null);
        this.statusSignal.set('guest');
      }
    } catch {
      /* keep current state */
    }
  }

  /** Post-boot check: refresh the snapshot, or flag the session as stale. */
  private async validateQuietly(): Promise<void> {
    if (this.statusSignal() !== 'signedIn') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const session = await this.provider.currentSession();
      if (session) {
        await this.commit(session);
      } else {
        // Definitively no live session (revoked/expired refresh) — keep the
        // identity visible, demand re-auth only when a cloud feature needs it.
        this.sessionStaleSignal.set(true);
      }
    } catch {
      // Network or SDK-load failure — cached identity stands, try next boot.
    }
  }
}
