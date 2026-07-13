import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { ApiError } from '@app/api/contracts';
import { Tree, TreeNode, newSyncBase } from '@app/db/schema';
import { Ctx } from '../lambda/authz';
import { Deps, K, LinkItem, ProfileItem, RecordItem } from '../lambda/db';
import { getForest } from '../lambda/handlers/forests';
import { pushSync } from '../lambda/handlers/sync';
import { createChild, deleteFamilyLink } from '../lambda/handlers/family';
import { createFriendRequest } from '../lambda/handlers/friends';

const NOW = 1_800_000_000_000;
const ddbMock = mockClient(DynamoDBDocumentClient);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

function deps(): Deps {
  return {
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({})),
    cognito: new CognitoIdentityProviderClient({}) as Deps['cognito'],
    table: 'roadmap',
    userPoolId: 'pool-1',
    now: () => NOW,
  };
}

function profile(userId: string, over: Partial<ProfileItem> = {}): ProfileItem {
  return {
    ...K.profile(userId),
    userId,
    username: userId,
    displayName: userId,
    accountType: 'adult',
    socialEnabled: true,
    createdAt: NOW - 1000,
    ...over,
  } as ProfileItem;
}

function ctxOf(caller: ProfileItem): Ctx {
  return { callerId: caller.userId, caller, deps: deps() };
}

function link(guardianId: string, minorId: string, kind: LinkItem['kind']): LinkItem {
  return {
    ...K.link(minorId, guardianId),
    gsi1pk: K.user(guardianId),
    gsi1sk: `MINOR#${minorId}`,
    linkId: `${guardianId}~${minorId}`,
    kind,
    guardianId,
    minorId,
    createdAt: NOW - 500,
  };
}

function tree(id: string): Tree {
  return { ...newSyncBase(NOW - 100), id, name: id, accent: 'moss', order: 10, currentNodeId: null, archivedAt: null };
}

function node(id: string, treeId: string): TreeNode {
  return {
    ...newSyncBase(NOW - 100),
    id,
    treeId,
    parentId: null,
    title: id,
    note: 'private words',
    status: 'growing',
    order: 10,
    targetDate: '2026-08-01',
    priority: 'sunlit',
    achievedAt: null,
    branchedAt: null,
    origin: 'planned',
    archivedAt: null,
    trigger: 'when-then',
  };
}

function recordItem(owner: string, store: 'trees' | 'nodes', record: Tree | TreeNode): RecordItem {
  return {
    ...K.rec(owner, store, record.id),
    gsi2pk: K.user(owner),
    gsi2sk: K.chg(NOW - 100, record.id),
    owner,
    store,
    record,
    rev: record.rev,
    syncedAt: NOW - 100,
  };
}

beforeEach(() => {
  ddbMock.reset();
  cognitoMock.reset();
});

// ── Forest authorization + stripping ─────────────────────────────────────────

function stubForest(owner: ProfileItem, relationLinks: LinkItem[], friends: boolean): void {
  ddbMock.on(GetCommand).callsFake((input) => {
    const { pk, sk } = input.Key as { pk: string; sk: string };
    if (sk === 'PROFILE' && pk === K.user(owner.userId)) return { Item: owner };
    const linkHit = relationLinks.find((l) => l.pk === pk && l.sk === sk);
    if (linkHit) return { Item: linkHit };
    if (sk.startsWith('FRIEND#') && friends) {
      return { Item: { pk, sk, friendshipId: 'x~y', userA: 'x', userB: 'y', createdAt: NOW } };
    }
    return { Item: undefined };
  });
  ddbMock.on(QueryCommand).callsFake((input) => {
    const prefix = (input.ExpressionAttributeValues as Record<string, string>)?.[':prefix'];
    if (prefix === 'REC#trees#') return { Items: [recordItem(owner.userId, 'trees', tree('t1'))] };
    if (prefix === 'REC#nodes#') return { Items: [recordItem(owner.userId, 'nodes', node('n1', 't1'))] };
    return { Items: [] };
  });
}

describe('getForest — permissions matrix', () => {
  it('stranger gets 404, never an existence hint', async () => {
    const nico = profile('nico', { accountType: 'minor', socialEnabled: false });
    stubForest(nico, [], false);
    const stranger = ctxOf(profile('stranger'));
    await expect(getForest(stranger, 'nico')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('guardian gets FULL nodes (co-gardening)', async () => {
    const nico = profile('nico', { accountType: 'minor', socialEnabled: false });
    stubForest(nico, [link('rocio', 'nico', 'created')], false);
    const rocio = ctxOf(profile('rocio'));
    const snapshot = await getForest(rocio, 'nico');
    expect(snapshot.detail).toBe('full');
    expect((snapshot.nodes[0] as TreeNode).note).toBe('private words');
    expect((snapshot.nodes[0] as TreeNode).targetDate).toBe('2026-08-01');
    expect((snapshot.nodes[0] as TreeNode).priority).toBe('sunlit'); // guardians see the light
  });

  it('friend gets the STRIPPED view', async () => {
    const ambar = profile('ambar');
    stubForest(ambar, [], true);
    const val = ctxOf(profile('val', { accountType: 'minor', socialEnabled: true }));
    const snapshot = await getForest(val, 'ambar');
    expect(snapshot.detail).toBe('stripped');
    const first = snapshot.nodes[0] as TreeNode;
    expect(first.note).toBe('');
    expect(first.trigger).toBeNull();
    expect(first.targetDate).toBeNull();
    expect(first.estimateMin ?? null).toBeNull(); // time guesses are intimate too (0.0.79)
    expect(first.repeatsDaily ?? undefined).toBeUndefined();
    expect(first.priority).toBeNull(); // «la luz» is private — never travels to friends
  });

  it('friend visits are blocked when social is off on either side', async () => {
    const ambar = profile('ambar', { socialEnabled: false });
    stubForest(ambar, [], true);
    const val = ctxOf(profile('val', { accountType: 'minor', socialEnabled: true }));
    await expect(getForest(val, 'ambar')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ── Sync LWW ─────────────────────────────────────────────────────────────────

describe('pushSync — rev LWW', () => {
  it('applies newer revs, rejects stale ones and returns the winner', async () => {
    const fresh = tree('t-fresh');
    const stale = { ...tree('t-stale'), rev: 1 };
    const winner = recordItem('rocio', 'trees', { ...tree('t-stale'), rev: 5 });

    ddbMock.on(PutCommand).callsFake((input) => {
      const item = input.Item as RecordItem;
      if (item.record && (item.record as Tree).id === 't-stale') {
        const error = new Error('conditional');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      }
      return {};
    });
    ddbMock.on(GetCommand).resolves({ Item: winner });

    const result = await pushSync(ctxOf(profile('rocio')), {
      schemaVersion: 3,
      records: [
        { store: 'trees', record: fresh },
        { store: 'trees', record: stale },
      ],
    });
    expect(result.applied).toEqual(['t-fresh']);
    expect(result.rejected).toEqual([{ id: 't-stale', reason: 'STALE_REV' }]);
    expect((result.serverRecords[0].record as Tree).rev).toBe(5);
  });

  it('caps the batch at LIMITS.syncPushMax', async () => {
    const records = Array.from({ length: 101 }, (_, i) => ({
      store: 'trees' as const,
      record: tree(`t${i}`),
    }));
    await expect(
      pushSync(ctxOf(profile('rocio')), { schemaVersion: 3, records }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});

// ── Family rules ─────────────────────────────────────────────────────────────

describe('family', () => {
  it('createChild maps UsernameExistsException to USERNAME_TAKEN', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] }); // no minors yet
    const taken = new Error('exists');
    taken.name = 'UsernameExistsException';
    cognitoMock.on(AdminCreateUserCommand).rejects(taken);
    await expect(
      createChild(ctxOf(profile('rocio')), { username: 'nico', displayName: 'Nico' }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('the last created-guardian link cannot be removed', async () => {
    const theLink = link('rocio', 'nico', 'created');
    ddbMock.on(GetCommand).resolves({ Item: theLink });
    ddbMock.on(QueryCommand).resolves({ Items: [theLink] }); // guardiansOf → only rocio
    await expect(
      deleteFamilyLink(ctxOf(profile('rocio')), 'rocio~nico'),
    ).rejects.toMatchObject({ code: 'LAST_GUARDIAN' });
  });

  it('a co-guardian can leave while another remains', async () => {
    const leaving = link('rocio', 'nico', 'created');
    const staying = link('abuela', 'nico', 'created');
    ddbMock.on(GetCommand).resolves({ Item: leaving });
    ddbMock.on(QueryCommand).resolves({ Items: [leaving, staying] });
    await expect(deleteFamilyLink(ctxOf(profile('rocio')), 'rocio~nico')).resolves.toBeUndefined();
  });
});

// ── Friend codes ─────────────────────────────────────────────────────────────

describe('friend requests', () => {
  // The brake is read-first, bump-on-BAD-attempt (contract law: successful
  // redemptions never count).
  const RATE_KEY = K.rate('val', Math.floor(NOW / 3_600_000));
  function stubRate(count: number): void {
    ddbMock
      .on(GetCommand, { TableName: 'roadmap', Key: { pk: RATE_KEY.pk, sk: RATE_KEY.sk } })
      .resolves({ Item: { ...RATE_KEY, count, ttl: 0 } });
  }

  it('expired codes answer CODE_EXPIRED and count as a bad attempt', async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { code: 'MBRD2468', kind: 'friend', userId: 'ambar', expiresAt: NOW - 1, ttl: 0 } });
    stubRate(1);
    ddbMock.on(UpdateCommand).resolves({});
    await expect(
      createFriendRequest(ctxOf(profile('val', { accountType: 'minor', socialEnabled: true })), {
        code: 'MBRD2468',
      }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
    expect(ddbMock.commandCalls(UpdateCommand).length).toBe(1); // the bump
  });

  it('the attempt after 5 bad redemptions in an hour is RATE_LIMITED', async () => {
    stubRate(5);
    await expect(
      createFriendRequest(ctxOf(profile('val', { socialEnabled: true })), { code: 'WRONGONE' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('social-off callers cannot touch friend surfaces', async () => {
    await expect(
      createFriendRequest(ctxOf(profile('nico', { accountType: 'minor', socialEnabled: false })), {
        code: 'MBRD2468',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── Error envelope sanity ────────────────────────────────────────────────────

describe('ApiError', () => {
  it('keeps its code through instanceof (shared class with the client)', () => {
    const error = new ApiError('LAST_GUARDIAN', 'x');
    expect(error instanceof ApiError).toBe(true);
    expect(error.code).toBe('LAST_GUARDIAN');
  });
});
