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
  MeResponse,
  PublicProfile,
  SyncChangesResponse,
  SyncPushRequest,
  SyncPushResponse,
  UserProfile,
} from './contracts';
import { ExportEnvelope } from '../db/schema';
import { AuthProvider } from '../auth/auth-provider';
import { parseMockToken } from '../auth/mock-auth.provider';
import { MockGuardianLinkRow, MockUserRow, mockGet, mockGetAll, mockPut, simLatency } from './mock-cloud';

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

  createChild(_req: CreateChildRequest): Promise<CreateChildResponse> {
    return this.notYet('familia');
  }
  resetChildPassword(_userId: string): Promise<{ tempPassword: string }> {
    return this.notYet('familia');
  }
  patchChild(
    _userId: string,
    _patch: { displayName?: string; socialEnabled?: boolean },
  ): Promise<UserProfile> {
    return this.notYet('familia');
  }
  exportChild(_userId: string): Promise<ExportEnvelope> {
    return this.notYet('familia');
  }
  deleteChild(_userId: string): Promise<void> {
    return this.notYet('familia');
  }
  deleteFamilyLink(_linkId: string): Promise<void> {
    return this.notYet('familia');
  }
  createFamilyInvite(_req: FamilyInviteRequest): Promise<CodeGrant> {
    return this.notYet('familia');
  }
  acceptFamilyInvite(_code: string): Promise<FamilyLinkView> {
    return this.notYet('familia');
  }
  revokeFamilyInvite(_code: string): Promise<void> {
    return this.notYet('familia');
  }
  listChildFriends(_userId: string): Promise<FriendsResponse> {
    return this.notYet('familia');
  }
  removeChildFriendship(_userId: string, _friendshipId: string): Promise<void> {
    return this.notYet('familia');
  }
  cancelChildRequest(_userId: string, _requestId: string): Promise<void> {
    return this.notYet('familia');
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

  // ── forests & sync (phases «conectar mi bosque» / «amigos y visitas») ────

  getForest(_userId: string): Promise<ForestSnapshot> {
    return this.notYet('amigos y visitas');
  }
  getSyncChanges(_cursor?: string): Promise<SyncChangesResponse> {
    return this.notYet('conectar mi bosque');
  }
  pushSync(_req: SyncPushRequest): Promise<SyncPushResponse> {
    return this.notYet('conectar mi bosque');
  }
  pushSyncFor(_userId: string, _req: SyncPushRequest): Promise<SyncPushResponse> {
    return this.notYet('conectar mi bosque');
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
}
