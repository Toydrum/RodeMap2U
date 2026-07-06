import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CLIENT } from './api/api-client';
import {
  ApiError,
  ApiErrorCode,
  CodeGrant,
  CreateChildResponse,
  FamilyInviteRequest,
  MeResponse,
} from './api/contracts';
import { AuthService } from './auth/auth.service';
import { get, put } from './db/idb';

/**
 * The family facade — signals over GET /me and the family operations.
 * Never runs at boot (boot stays network-free): the familia surface calls
 * `open()` when it appears. Stale-while-revalidate: the last MeResponse is
 * cached under a meta key so the card paints instantly offline, then a
 * background refresh reconciles. Every mutation refreshes `me`.
 */

const META_FAMILY_ME = 'family.me';

interface FamilyMeSnapshot {
  key: typeof META_FAMILY_ME;
  userId: string;
  me: MeResponse;
  cachedAt: number;
}

@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly api = inject(API_CLIENT);
  private readonly auth = inject(AuthService);

  private readonly meSignal = signal<MeResponse | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly lastErrorSignal = signal<ApiErrorCode | null>(null);

  readonly me = this.meSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  readonly minors = computed(() => this.meSignal()?.family.minors ?? []);
  readonly guardians = computed(() => this.meSignal()?.family.guardians ?? []);

  /** Cache-first paint + background refresh. Call when the surface opens. */
  async open(): Promise<void> {
    const userId = this.auth.user()?.userId;
    if (!userId) return;
    try {
      const cached = await get<FamilyMeSnapshot>('meta', META_FAMILY_ME);
      if (cached?.userId === userId && !this.meSignal()) this.meSignal.set(cached.me);
    } catch {
      /* no cache — network will answer */
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const userId = this.auth.user()?.userId;
    if (!userId) {
      this.meSignal.set(null);
      return;
    }
    this.loadingSignal.set(true);
    this.lastErrorSignal.set(null);
    try {
      const me = await this.api.getMe();
      this.meSignal.set(me);
      try {
        await put('meta', {
          key: META_FAMILY_ME,
          userId,
          me,
          cachedAt: Date.now(),
        } satisfies FamilyMeSnapshot);
      } catch {
        /* memory-only session */
      }
    } catch (error) {
      // Cached view stands; the card shows the calm error line.
      this.lastErrorSignal.set(error instanceof ApiError ? error.code : 'unknown');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Wipes the signal on sign-out (the meta cache is keyed by user anyway). */
  clear(): void {
    this.meSignal.set(null);
    this.lastErrorSignal.set(null);
  }

  // ── operations (each returns a value for the sheet, then refreshes) ───────

  async createChild(username: string, displayName: string): Promise<CreateChildResponse | null> {
    return this.run(async () => {
      const result = await this.api.createChild({ username, displayName });
      await this.refresh();
      return result;
    });
  }

  async resetChildPassword(userId: string): Promise<{ tempPassword: string } | null> {
    return this.run(() => this.api.resetChildPassword(userId));
  }

  async renameChild(userId: string, displayName: string): Promise<boolean> {
    return (
      (await this.run(async () => {
        await this.api.patchChild(userId, { displayName });
        await this.refresh();
        return true;
      })) ?? false
    );
  }

  async setChildSocial(userId: string, socialEnabled: boolean): Promise<boolean> {
    return (
      (await this.run(async () => {
        await this.api.patchChild(userId, { socialEnabled });
        await this.refresh();
        return true;
      })) ?? false
    );
  }

  async unlink(linkId: string): Promise<boolean> {
    return (
      (await this.run(async () => {
        await this.api.deleteFamilyLink(linkId);
        await this.refresh();
        return true;
      })) ?? false
    );
  }

  /** Export-first deletion: the backup downloads BEFORE the purge, always. */
  async deleteChild(userId: string, username: string): Promise<boolean> {
    return (
      (await this.run(async () => {
        const envelope = await this.api.exportChild(userId);
        this.download(`rodemap2u-${username}-respaldo.json`, envelope);
        await this.api.deleteChild(userId);
        await this.refresh();
        return true;
      })) ?? false
    );
  }

  async exportChild(userId: string, username: string): Promise<boolean> {
    return (
      (await this.run(async () => {
        const envelope = await this.api.exportChild(userId);
        this.download(`rodemap2u-${username}-respaldo.json`, envelope);
        return true;
      })) ?? false
    );
  }

  async createInvite(req: FamilyInviteRequest): Promise<CodeGrant | null> {
    return this.run(() => this.api.createFamilyInvite(req));
  }

  async acceptInvite(code: string): Promise<boolean> {
    return (
      (await this.run(async () => {
        await this.api.acceptFamilyInvite(code);
        await this.refresh();
        return true;
      })) ?? false
    );
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async run<T>(operation: () => Promise<T>): Promise<T | null> {
    this.loadingSignal.set(true);
    this.lastErrorSignal.set(null);
    try {
      return await operation();
    } catch (error) {
      this.lastErrorSignal.set(error instanceof ApiError ? error.code : 'unknown');
      return null;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private download(filename: string, payload: unknown): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
