import { randomUUID } from 'node:crypto';
import {
  ApiError,
  CodeGrant,
  FriendRequestView,
  FriendView,
  FriendsResponse,
  LIMITS,
} from '@app/api/contracts';
import { Ctx, friendshipBetween, profileOf, requireSocial, toPublic } from '../authz';
import {
  CodeItem,
  Deps,
  FriendItem,
  FriendRequestItem,
  K,
  ProfileItem,
  RateItem,
  TransactWriteCommand,
  UpdateCommand,
  composite,
  deleteItem,
  getItem,
  putItem,
  queryPrefix,
} from '../db';
import { friendCode } from '../codes';

const FRIEND_CODE_TTL_MS = 7 * 24 * 3600 * 1000;
const REQUEST_TTL_MS = 14 * 24 * 3600 * 1000;

async function requestView(deps: Deps, item: FriendRequestItem, otherId: string): Promise<FriendRequestView | null> {
  const other = await profileOf(deps, otherId);
  if (!other) return null;
  return {
    requestId: item.requestId,
    user: toPublic(other, false),
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
  };
}

export async function getFriends(ctx: Ctx): Promise<FriendsResponse> {
  return friendsOf(ctx, ctx.callerId);
}

/** Shared with guardian oversight (family.listChildFriends). */
export async function friendsOf(ctx: Ctx, userId: string): Promise<FriendsResponse> {
  const now = ctx.deps.now();
  const [friendItems, incomingItems, outgoingItems] = await Promise.all([
    queryPrefix<FriendItem>(ctx.deps, K.user(userId), 'FRIEND#'),
    queryPrefix<FriendRequestItem>(ctx.deps, K.user(userId), 'FREQ#'),
    queryPrefix<FriendRequestItem>(ctx.deps, K.user(userId), 'FREQ#', { index: 'gsi1' }),
  ]);

  const friends: FriendView[] = [];
  for (const item of friendItems) {
    const otherId = item.userA === userId ? item.userB : item.userA;
    const other = await profileOf(ctx.deps, otherId);
    if (!other) continue;
    friends.push({ friendshipId: item.friendshipId, user: toPublic(other, false), since: item.createdAt });
  }
  const incoming: FriendRequestView[] = [];
  for (const item of incomingItems.filter((i) => i.expiresAt > now)) {
    const view = await requestView(ctx.deps, item, item.fromId);
    if (view) incoming.push(view);
  }
  const outgoing: FriendRequestView[] = [];
  for (const item of outgoingItems.filter((i) => i.expiresAt > now)) {
    const view = await requestView(ctx.deps, item, item.toId);
    if (view) outgoing.push(view);
  }
  return { friends, incoming, outgoing };
}

async function mintFriendCode(ctx: Ctx): Promise<CodeGrant> {
  const code = friendCode();
  const expiresAt = ctx.deps.now() + FRIEND_CODE_TTL_MS;
  await putItem(ctx.deps, {
    ...K.codeF(code),
    code,
    kind: 'friend',
    userId: ctx.callerId,
    expiresAt,
    ttl: Math.ceil(expiresAt / 1000),
  } satisfies CodeItem & { pk: string; sk: string });
  await ctx.deps.ddb.send(
    new UpdateCommand({
      TableName: ctx.deps.table,
      Key: K.profile(ctx.callerId),
      UpdateExpression: 'SET friendCode = :c',
      ExpressionAttributeValues: { ':c': code },
    }),
  );
  return { code, expiresAt };
}

export async function getFriendCode(ctx: Ctx): Promise<CodeGrant> {
  requireSocial(ctx);
  if (ctx.caller.friendCode) {
    const existing = await getItem<CodeItem>(ctx.deps, K.codeF(ctx.caller.friendCode));
    if (existing && existing.expiresAt > ctx.deps.now()) {
      return { code: existing.code, expiresAt: existing.expiresAt };
    }
  }
  return mintFriendCode(ctx);
}

export async function rotateFriendCode(ctx: Ctx): Promise<CodeGrant> {
  requireSocial(ctx);
  if (ctx.caller.friendCode) await deleteItem(ctx.deps, K.codeF(ctx.caller.friendCode));
  return mintFriendCode(ctx);
}

/** 5 bad redemptions per rolling hour → RATE_LIMITED (code-guessing brake). */
async function bumpRateLimit(ctx: Ctx): Promise<void> {
  const bucket = Math.floor(ctx.deps.now() / 3_600_000);
  const key = K.rate(ctx.callerId, bucket);
  const out = await ctx.deps.ddb.send(
    new UpdateCommand({
      TableName: ctx.deps.table,
      Key: key,
      UpdateExpression: 'ADD #c :one SET #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':one': 1, ':ttl': Math.ceil(ctx.deps.now() / 1000) + 7200 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  const count = ((out.Attributes as RateItem | undefined)?.count ?? 0) as number;
  if (count > LIMITS.codeAttemptsPerHour) throw new ApiError('RATE_LIMITED');
}

export async function createFriendRequest(ctx: Ctx, body: { code?: string }): Promise<FriendRequestView> {
  requireSocial(ctx);
  const code = body.code?.trim().toUpperCase().replace(/-/g, '');
  if (!code) throw new ApiError('VALIDATION', 'code required');

  await bumpRateLimit(ctx);
  const grant = await getItem<CodeItem>(ctx.deps, K.codeF(code));
  if (!grant || grant.kind !== 'friend') throw new ApiError('CODE_INVALID');
  if (grant.expiresAt <= ctx.deps.now()) throw new ApiError('CODE_EXPIRED');
  if (grant.userId === ctx.callerId) throw new ApiError('VALIDATION', 'that is your own code');

  const target = await profileOf(ctx.deps, grant.userId);
  if (!target || !target.socialEnabled) throw new ApiError('CODE_INVALID');
  if (await friendshipBetween(ctx.deps, ctx.callerId, grant.userId)) {
    throw new ApiError('CONFLICT', 'already friends');
  }
  const myFriends = await queryPrefix<FriendItem>(ctx.deps, K.user(ctx.callerId), 'FRIEND#');
  if (myFriends.length >= LIMITS.maxFriends) throw new ApiError('LIMIT_EXCEEDED');

  const now = ctx.deps.now();
  const requestId = randomUUID();
  const item: FriendRequestItem = {
    ...K.freq(grant.userId, requestId),
    gsi1pk: K.user(ctx.callerId),
    gsi1sk: `FREQ#${requestId}`,
    requestId,
    fromId: ctx.callerId,
    toId: grant.userId,
    createdAt: now,
    expiresAt: now + REQUEST_TTL_MS,
    ttl: Math.ceil((now + REQUEST_TTL_MS) / 1000),
  };
  await putItem(ctx.deps, item as unknown as Record<string, unknown>);
  return { requestId, user: toPublic(target, false), createdAt: now, expiresAt: item.expiresAt };
}

async function findIncoming(ctx: Ctx, requestId: string): Promise<FriendRequestItem> {
  const item = await getItem<FriendRequestItem>(ctx.deps, K.freq(ctx.callerId, requestId));
  if (!item || item.expiresAt <= ctx.deps.now()) throw new ApiError('NOT_FOUND');
  return item;
}

export async function acceptFriendRequest(ctx: Ctx, requestId: string): Promise<FriendView> {
  requireSocial(ctx);
  const request = await findIncoming(ctx, requestId);
  const other = await profileOf(ctx.deps, request.fromId);
  if (!other) throw new ApiError('NOT_FOUND');

  const friendshipId = composite.friendshipId(ctx.callerId, request.fromId);
  const now = ctx.deps.now();
  const mirror = (me: string, otherId: string): FriendItem => ({
    ...K.friend(me, otherId),
    friendshipId,
    userA: friendshipId.split('~')[0],
    userB: friendshipId.split('~')[1],
    createdAt: now,
  });
  await ctx.deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: ctx.deps.table, Item: mirror(ctx.callerId, request.fromId) } },
        { Put: { TableName: ctx.deps.table, Item: mirror(request.fromId, ctx.callerId) } },
        { Delete: { TableName: ctx.deps.table, Key: K.freq(ctx.callerId, requestId) } },
      ],
    }),
  );
  return { friendshipId, user: toPublic(other, false), since: now };
}

/** Silent by design — the requester's pending item simply disappears. */
export async function declineFriendRequest(ctx: Ctx, requestId: string): Promise<void> {
  await findIncoming(ctx, requestId);
  await deleteItem(ctx.deps, K.freq(ctx.callerId, requestId));
}

export async function cancelFriendRequest(ctx: Ctx, requestId: string): Promise<void> {
  const mine = await queryPrefix<FriendRequestItem>(ctx.deps, K.user(ctx.callerId), 'FREQ#', {
    index: 'gsi1',
  });
  const item = mine.find((r) => r.requestId === requestId);
  if (!item) throw new ApiError('NOT_FOUND');
  await deleteItem(ctx.deps, K.freq(item.toId, requestId));
}

export async function removeFriend(ctx: Ctx, friendshipId: string): Promise<void> {
  await removeFriendshipAs(ctx, ctx.callerId, friendshipId);
}

/** Shared with guardian oversight — `asUserId` must be one side of the edge. */
export async function removeFriendshipAs(ctx: Ctx, asUserId: string, friendshipId: string): Promise<void> {
  const pair = composite.parseFriendshipId(friendshipId);
  if (!pair || (pair.a !== asUserId && pair.b !== asUserId)) throw new ApiError('NOT_FOUND');
  await ctx.deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: ctx.deps.table, Key: K.friend(pair.a, pair.b) } },
        { Delete: { TableName: ctx.deps.table, Key: K.friend(pair.b, pair.a) } },
      ],
    }),
  );
}
