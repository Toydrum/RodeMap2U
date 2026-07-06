import { ApiClient } from './api-client';
import {
  ApiError,
  CodeGrant,
  CreateChildRequest,
  CreateChildResponse,
  FamilyInviteRequest,
  FamilyLinkView,
  FriendRequestView,
  FriendView,
  FriendsResponse,
  ForestSnapshot,
  LIMITS,
  MeResponse,
  PublicProfile,
  SyncChangesResponse,
  SyncPushRequest,
  SyncPushResponse,
  UserProfile,
} from './contracts';
import { CheckIn, ExportEnvelope, SCHEMA_VERSION, TimerSession, Tree, TreeNode } from '../db/schema';
import { AuthProvider } from '../auth/auth-provider';
import { USERNAME_PATTERN } from '../auth/auth-types';
import { parseMockToken } from '../auth/mock-auth.provider';
import {
  MockCodeRow,
  MockCredentialRow,
  MockFriendRequestRow,
  MockFriendshipRow,
  MockGuardianLinkRow,
  MockRecordRow,
  MockUserRow,
  mockDelete,
  mockGet,
  mockGetAll,
  mockHash,
  mockNextSeq,
  mockPut,
  simLatency,
} from './mock-cloud';

const INVITE_TTL_MS = 72 * 3600 * 1000;

/**
 * The executable contract spec: same interface, same permission rules, same
 * error codes the Lambdas must implement — running against the on-device
 * mock cloud. Endpoints land with their phase; the ones that would silently
 * lie if stubbed throw instead.
 */
export class MockApi implements ApiClient {
  constructor(private readonly auth: AuthProvider) {}

  // ── me (phase «cuentas») ──────────────────────────────────────────────────

  async getMe(): Promise<MeResponse> {
    await simLatency('api.getMe');
    const caller = await this.caller();
    const links = await mockGetAll<MockGuardianLinkRow>('guardianLinks');
    const guardians: FamilyLinkView[] = [];
    const minors: FamilyLinkView[] = [];
    for (const link of links) {
      if (link.minorId === caller.userId) {
        guardians.push(await this.linkView(link, link.guardianId, false));
      } else if (link.guardianId === caller.userId) {
        minors.push(await this.linkView(link, link.minorId, true));
      }
    }
    return { profile: this.profileOf(caller), family: { guardians, minors } };
  }

  async patchMe(patch: { displayName?: string }): Promise<UserProfile> {
    await simLatency('api.patchMe');
    const caller = await this.caller();
    const displayName = patch.displayName?.trim();
    if (displayName !== undefined) {
      if (!displayName || displayName.length > 40) throw new ApiError('VALIDATION');
      caller.displayName = displayName;
      await mockPut('users', caller);
    }
    return this.profileOf(caller);
  }

  // ── family (phase «familia») ──────────────────────────────────────────────

  async createChild(req: CreateChildRequest): Promise<CreateChildResponse> {
    await simLatency('api.createChild');
    const caller = await this.caller();
    if (caller.accountType !== 'adult') throw new ApiError('FORBIDDEN', 'only adults create minors');
    const username = req.username?.trim().toLowerCase() ?? '';
    const displayName = req.displayName?.trim() ?? '';
    if (!USERNAME_PATTERN.test(username)) throw new ApiError('VALIDATION', 'username 3-20 [a-z0-9_]');
    if (!displayName || displayName.length > 40) throw new ApiError('VALIDATION', 'displayName 1-40');
    if ((await this.minorsOf(caller.userId)).length >= LIMITS.maxChildrenPerGuardian) {
      throw new ApiError('LIMIT_EXCEEDED');
    }
    if (await mockGet<MockCredentialRow>('credentials', username)) {
      throw new ApiError('USERNAME_TAKEN');
    }
    const tempPassword = await this.mintTempPassword(username);
    const now = Date.now();
    const child: MockUserRow = {
      userId: `u-${username}`,
      username,
      displayName,
      accountType: 'minor',
      socialEnabled: false,
      createdAt: now,
      email: null,
    };
    await mockPut('users', child);
    await mockPut('credentials', {
      username,
      userId: child.userId,
      password: tempPassword,
      mustChangePassword: true,
      pendingConfirm: false,
    } satisfies MockCredentialRow);
    await mockPut('guardianLinks', this.newLink(caller.userId, child.userId, 'created', now));
    return { child: this.profileOf(child), tempPassword };
  }

  async resetChildPassword(userId: string): Promise<{ tempPassword: string }> {
    await simLatency('api.resetChildPassword');
    const caller = await this.caller();
    await this.requireCreatedLink(caller.userId, userId);
    const child = await mockGet<MockUserRow>('users', userId);
    if (!child) throw new ApiError('NOT_FOUND');
    const cred = await mockGet<MockCredentialRow>('credentials', child.username);
    if (!cred) throw new ApiError('NOT_FOUND');
    const tempPassword = await this.mintTempPassword(child.username);
    await mockPut('credentials', { ...cred, password: tempPassword, mustChangePassword: true });
    return { tempPassword };
  }

  async patchChild(
    userId: string,
    patch: { displayName?: string; socialEnabled?: boolean },
  ): Promise<UserProfile> {
    await simLatency('api.patchChild');
    const caller = await this.caller();
    await this.requireCreatedLink(caller.userId, userId);
    const child = await mockGet<MockUserRow>('users', userId);
    if (!child) throw new ApiError('NOT_FOUND');
    if (patch.displayName !== undefined) {
      const displayName = patch.displayName.trim();
      if (!displayName || displayName.length > 40) throw new ApiError('VALIDATION');
      child.displayName = displayName;
    }
    if (patch.socialEnabled !== undefined) child.socialEnabled = !!patch.socialEnabled;
    await mockPut('users', child);
    return this.profileOf(child);
  }

  async exportChild(userId: string): Promise<ExportEnvelope> {
    await simLatency('api.exportChild');
    const caller = await this.caller();
    await this.requireCreatedLink(caller.userId, userId);
    const records = (await mockGetAll<MockRecordRow>('records')).filter((r) => r.ownerId === userId);
    const of = <T>(store: string): T[] =>
      records.filter((r) => r.store === store).map((r) => r.record as T);
    return {
      app: 'rodemap2u',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        trees: of<Tree>('trees'),
        nodes: of<TreeNode>('nodes'),
        checkins: of<CheckIn>('checkins'),
        sessions: of<TimerSession>('sessions'),
        settings: null, // device preferences never reach the cloud
      },
    };
  }

  /** Export-first is the CLIENT flow; here the purge is total and final. */
  async deleteChild(userId: string): Promise<void> {
    await simLatency('api.deleteChild');
    const caller = await this.caller();
    await this.requireCreatedLink(caller.userId, userId);
    const child = await mockGet<MockUserRow>('users', userId);
    if (!child) throw new ApiError('NOT_FOUND');

    await mockDelete('credentials', child.username);
    await mockDelete('users', userId);
    for (const link of await mockGetAll<MockGuardianLinkRow>('guardianLinks')) {
      if (link.minorId === userId || link.guardianId === userId) {
        await mockDelete('guardianLinks', link.linkId);
      }
    }
    for (const friendship of await mockGetAll<MockFriendshipRow>('friendships')) {
      if (friendship.userA === userId || friendship.userB === userId) {
        await mockDelete('friendships', friendship.friendshipId);
      }
    }
    for (const request of await mockGetAll<MockFriendRequestRow>('friendRequests')) {
      if (request.fromId === userId || request.toId === userId) {
        await mockDelete('friendRequests', request.requestId);
      }
    }
    for (const code of await mockGetAll<MockCodeRow>('codes')) {
      if (code.userId === userId || code.minorId === userId) {
        await mockDelete('codes', code.code);
      }
    }
    for (const record of await mockGetAll<MockRecordRow>('records')) {
      if (record.ownerId === userId) await mockDelete('records', record.key);
    }
  }

  async deleteFamilyLink(linkId: string): Promise<void> {
    await simLatency('api.deleteFamilyLink');
    const caller = await this.caller();
    const link = await mockGet<MockGuardianLinkRow>('guardianLinks', linkId);
    if (!link) throw new ApiError('NOT_FOUND');
    const callerIsGuardian = caller.userId === link.guardianId;
    const callerIsMinorSide = caller.userId === link.minorId && link.kind === 'invited';
    if (!callerIsGuardian && !callerIsMinorSide) throw new ApiError('NOT_FOUND');
    if (link.kind === 'created') {
      const remaining = (await this.guardiansOf(link.minorId)).filter(
        (l) => l.linkId !== link.linkId,
      );
      if (!remaining.length) throw new ApiError('LAST_GUARDIAN');
    }
    await mockDelete('guardianLinks', linkId);
  }

  async createFamilyInvite(req: FamilyInviteRequest): Promise<CodeGrant> {
    await simLatency('api.createFamilyInvite');
    const caller = await this.caller();
    if (caller.accountType !== 'adult') throw new ApiError('FORBIDDEN');
    let minorId: string | null = null;
    if (req.kind === 'coGuardian') {
      const link = await this.linkBetween(caller.userId, req.minorId);
      if (!link) throw new ApiError('NOT_FOUND');
      if ((await this.guardiansOf(req.minorId)).length >= LIMITS.maxGuardiansPerMinor) {
        throw new ApiError('LIMIT_EXCEEDED');
      }
      minorId = req.minorId;
    } else if (req.kind !== 'linkExisting') {
      throw new ApiError('VALIDATION', 'unknown invite kind');
    }
    const code = await this.mintCode();
    const expiresAt = Date.now() + INVITE_TTL_MS;
    await mockPut('codes', {
      code,
      kind: req.kind,
      userId: caller.userId,
      minorId,
      expiresAt,
    } satisfies MockCodeRow);
    return { code, expiresAt };
  }

  async acceptFamilyInvite(rawCode: string): Promise<FamilyLinkView> {
    await simLatency('api.acceptFamilyInvite');
    const caller = await this.caller();
    const code = rawCode?.trim().toUpperCase().replace(/-/g, '');
    if (!code) throw new ApiError('VALIDATION');
    const invite = await mockGet<MockCodeRow>('codes', code);
    if (!invite || invite.kind === 'friend') throw new ApiError('CODE_INVALID');
    if (invite.expiresAt <= Date.now()) throw new ApiError('CODE_EXPIRED');

    const now = Date.now();
    if (invite.kind === 'coGuardian') {
      // Redeemer becomes a co-guardian (full admin) of the invite's minor.
      if (caller.accountType !== 'adult') throw new ApiError('FORBIDDEN');
      const minorId = invite.minorId!;
      const minor = await mockGet<MockUserRow>('users', minorId);
      if (!minor) throw new ApiError('NOT_FOUND');
      if (await this.linkBetween(caller.userId, minorId)) {
        throw new ApiError('CONFLICT', 'already a guardian');
      }
      if ((await this.guardiansOf(minorId)).length >= LIMITS.maxGuardiansPerMinor) {
        throw new ApiError('LIMIT_EXCEEDED');
      }
      const link = this.newLink(caller.userId, minorId, 'created', now);
      await mockPut('guardianLinks', link);
      await mockDelete('codes', code); // single-use
      return this.linkView(link, minorId, true);
    }

    // linkExisting: the REDEEMER consents to become the issuer's invited minor.
    const issuer = await mockGet<MockUserRow>('users', invite.userId);
    if (!issuer) throw new ApiError('CODE_INVALID');
    if (invite.userId === caller.userId) throw new ApiError('VALIDATION', 'own invite');
    if (await this.linkBetween(invite.userId, caller.userId)) {
      throw new ApiError('CONFLICT', 'already linked');
    }
    if ((await this.minorsOf(invite.userId)).length >= LIMITS.maxChildrenPerGuardian) {
      throw new ApiError('LIMIT_EXCEEDED');
    }
    const link = this.newLink(invite.userId, caller.userId, 'invited', now);
    await mockPut('guardianLinks', link);
    await mockDelete('codes', code);
    // The redeemer sees the GUARDIAN on the other end of the new link.
    return this.linkView(link, invite.userId, false);
  }

  async revokeFamilyInvite(rawCode: string): Promise<void> {
    await simLatency('api.revokeFamilyInvite');
    const caller = await this.caller();
    const code = rawCode?.trim().toUpperCase().replace(/-/g, '') ?? '';
    const invite = await mockGet<MockCodeRow>('codes', code);
    if (!invite || invite.userId !== caller.userId || invite.kind === 'friend') {
      throw new ApiError('NOT_FOUND');
    }
    await mockDelete('codes', code);
  }

  listChildFriends(_userId: string): Promise<FriendsResponse> {
    return this.notYet('amigos y visitas');
  }
  removeChildFriendship(_userId: string, _friendshipId: string): Promise<void> {
    return this.notYet('amigos y visitas');
  }
  cancelChildRequest(_userId: string, _requestId: string): Promise<void> {
    return this.notYet('amigos y visitas');
  }

  // ── friends (phase «amigos y visitas») ────────────────────────────────────

  getFriends(): Promise<FriendsResponse> {
    return this.notYet('amigos y visitas');
  }
  getFriendCode(): Promise<CodeGrant> {
    return this.notYet('amigos y visitas');
  }
  rotateFriendCode(): Promise<CodeGrant> {
    return this.notYet('amigos y visitas');
  }
  createFriendRequest(_code: string): Promise<FriendRequestView> {
    return this.notYet('amigos y visitas');
  }
  acceptFriendRequest(_requestId: string): Promise<FriendView> {
    return this.notYet('amigos y visitas');
  }
  declineFriendRequest(_requestId: string): Promise<void> {
    return this.notYet('amigos y visitas');
  }
  cancelFriendRequest(_requestId: string): Promise<void> {
    return this.notYet('amigos y visitas');
  }
  removeFriend(_friendshipId: string): Promise<void> {
    return this.notYet('amigos y visitas');
  }

  // ── forests & sync ────────────────────────────────────────────────────────

  /** Detail per the matrix: guardians get FULL nodes (co-gardening), family-up
   *  and friends get the STRIPPED view, strangers get 404 (no oracle). */
  async getForest(userId: string): Promise<ForestSnapshot> {
    await simLatency('api.getForest');
    const caller = await this.caller();
    let detail: ForestSnapshot['detail'] | null = null;
    let includeSocial = false;
    if (caller.userId === userId || (await this.linkBetween(caller.userId, userId))) {
      detail = 'full';
      includeSocial = caller.userId !== userId;
    } else if (await this.linkBetween(userId, caller.userId)) {
      detail = 'stripped'; // family visibility is mutual — minor sees guardian
    } else {
      const friends = (await mockGetAll<MockFriendshipRow>('friendships')).some(
        (f) =>
          (f.userA === caller.userId && f.userB === userId) ||
          (f.userB === caller.userId && f.userA === userId),
      );
      const target = await mockGet<MockUserRow>('users', userId);
      if (friends && caller.socialEnabled && target?.socialEnabled) detail = 'stripped';
    }
    if (!detail) throw new ApiError('NOT_FOUND');
    const owner = await mockGet<MockUserRow>('users', userId);
    if (!owner) throw new ApiError('NOT_FOUND');

    const records = (await mockGetAll<MockRecordRow>('records')).filter(
      (r) => r.ownerId === userId,
    );
    const trees = records
      .filter((r) => r.store === 'trees')
      .map((r) => r.record as Tree)
      .filter((t) => !t.deletedAt && !t.archivedAt);
    const liveTreeIds = new Set(trees.map((t) => t.id));
    const nodes = records
      .filter((r) => r.store === 'nodes')
      .map((r) => r.record as TreeNode)
      .filter((n) => !n.deletedAt && !n.archivedAt && liveTreeIds.has(n.treeId))
      .map((n) => (detail === 'full' ? n : { ...n, note: '', trigger: null, targetDate: null }));

    return {
      owner: this.publicOf(owner, includeSocial),
      detail,
      trees,
      nodes,
      fetchedAt: Date.now(),
    };
  }

  getSyncChanges(_cursor?: string): Promise<SyncChangesResponse> {
    return this.notYet('conectar mi bosque');
  }
  pushSync(_req: SyncPushRequest): Promise<SyncPushResponse> {
    return this.notYet('conectar mi bosque');
  }

  /** Guardian write-through (co-gardening): same rev-LWW law as own pushes;
   *  records land in the minor's cloud store. */
  async pushSyncFor(userId: string, req: SyncPushRequest): Promise<SyncPushResponse> {
    await simLatency('api.pushSyncFor');
    const caller = await this.caller();
    const link = await this.linkBetween(caller.userId, userId);
    if (!link) throw new ApiError('NOT_FOUND');
    if (!Array.isArray(req.records)) throw new ApiError('VALIDATION');
    if (req.records.length > LIMITS.syncPushMax) throw new ApiError('LIMIT_EXCEEDED');

    const applied: string[] = [];
    const rejected: { id: string; reason: 'STALE_REV' }[] = [];
    const serverRecords: SyncPushResponse['serverRecords'] = [];
    const syncedAt = Date.now();
    for (const entry of req.records) {
      const record = entry.record;
      const key = `${userId}|${entry.store}|${record.id}`;
      const stored = await mockGet<MockRecordRow>('records', key);
      if (stored && (stored.record.rev ?? 0) >= record.rev) {
        rejected.push({ id: record.id, reason: 'STALE_REV' });
        serverRecords.push({ store: stored.store, record: stored.record });
        continue;
      }
      const seq = await mockNextSeq('changeSeq');
      await mockPut('records', {
        key,
        ownerId: userId,
        store: entry.store,
        record,
        seq,
        syncedAt,
      } satisfies MockRecordRow);
      applied.push(record.id);
    }
    return { applied, rejected, serverRecords };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Bearer-token gate — same 401 semantics HttpApi will meet in production. */
  private async caller(): Promise<MockUserRow> {
    const token = await this.auth.idToken();
    const payload = token ? parseMockToken(token) : null;
    if (!payload) throw new ApiError('UNAUTHENTICATED');
    const user = await mockGet<MockUserRow>('users', payload.sub);
    if (!user) throw new ApiError('UNAUTHENTICATED');
    return user;
  }

  private profileOf(user: MockUserRow): UserProfile {
    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      accountType: user.accountType,
      socialEnabled: user.socialEnabled,
      createdAt: user.createdAt,
    };
  }

  private publicOf(user: MockUserRow, includeSocial: boolean): PublicProfile {
    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      accountType: user.accountType,
      ...(includeSocial ? { socialEnabled: user.socialEnabled } : {}),
    };
  }

  /** `socialEnabled` is exposed only on minors the caller guards. */
  private async linkView(
    link: MockGuardianLinkRow,
    otherId: string,
    includeSocial: boolean,
  ): Promise<FamilyLinkView> {
    const other = await mockGet<MockUserRow>('users', otherId);
    if (!other) throw new ApiError('NOT_FOUND');
    const user: PublicProfile = {
      userId: other.userId,
      username: other.username,
      displayName: other.displayName,
      accountType: other.accountType,
      ...(includeSocial ? { socialEnabled: other.socialEnabled } : {}),
    };
    return { linkId: link.linkId, kind: link.kind, user, createdAt: link.createdAt };
  }

  private notYet(phase: string): Promise<never> {
    throw new ApiError('unknown', `mock endpoint arrives with phase «${phase}»`);
  }

  // ── family internals ──────────────────────────────────────────────────────

  private async linkBetween(
    guardianId: string,
    minorId: string,
  ): Promise<MockGuardianLinkRow | null> {
    const links = await mockGetAll<MockGuardianLinkRow>('guardianLinks');
    return links.find((l) => l.guardianId === guardianId && l.minorId === minorId) ?? null;
  }

  private async minorsOf(guardianId: string): Promise<MockGuardianLinkRow[]> {
    return (await mockGetAll<MockGuardianLinkRow>('guardianLinks')).filter(
      (l) => l.guardianId === guardianId,
    );
  }

  private async guardiansOf(minorId: string): Promise<MockGuardianLinkRow[]> {
    return (await mockGetAll<MockGuardianLinkRow>('guardianLinks')).filter(
      (l) => l.minorId === minorId,
    );
  }

  /** Identity-admin gate — 404-shaped like the real Lambda (no oracle). */
  private async requireCreatedLink(guardianId: string, minorId: string): Promise<MockGuardianLinkRow> {
    const link = await this.linkBetween(guardianId, minorId);
    if (!link) throw new ApiError('NOT_FOUND');
    if (link.kind !== 'created') {
      throw new ApiError('FORBIDDEN', 'invited links have no identity admin');
    }
    return link;
  }

  private newLink(
    guardianId: string,
    minorId: string,
    kind: MockGuardianLinkRow['kind'],
    now: number,
  ): MockGuardianLinkRow {
    return { linkId: `${guardianId}~${minorId}`, guardianId, minorId, kind, createdAt: now };
  }

  /** Deterministic (rule 4) yet unique: seq counter + hash. Meets the policy. */
  private async mintTempPassword(username: string): Promise<string> {
    const seq = await mockNextSeq('pwseq');
    return `Brote${1000 + (mockHash(`${username}:pw:${seq}`) % 9000)}`;
  }

  private async mintCode(): Promise<string> {
    const alphabet = '2346790CDFGHJKMNPQRTVWXZ';
    const seq = await mockNextSeq('codeseq');
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[mockHash(`code:${seq}:${i}`) % alphabet.length];
    return code;
  }
}
