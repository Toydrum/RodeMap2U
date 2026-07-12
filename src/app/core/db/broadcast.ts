import { StoreName } from './idb';

/**
 * Cross-tab record refresh. Every mutation posts {store, ids}; other tabs
 * re-read those records and apply them if the incoming rev is newer.
 * Cloud sync rides the same two rails: outbound via onLocalWrite (below),
 * inbound via RecordsRepo.applyExternal — see core/api/contracts.ts.
 */

export interface DbChangeMessage {
  store: StoreName;
  ids: string[];
}

const CHANNEL_NAME = 'roadmap2u-db';

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

type LocalWriteHandler = (message: DbChangeMessage) => void;

/** BroadcastChannel never echoes to the posting tab — this registry is how
 *  THIS tab observes its own writes (the sync engine's push trigger). */
const localHandlers = new Set<LocalWriteHandler>();

export function onLocalWrite(handler: LocalWriteHandler): () => void {
  localHandlers.add(handler);
  return () => localHandlers.delete(handler);
}

export function broadcastChange(message: DbChangeMessage): void {
  for (const handler of localHandlers) handler(message);
  channel?.postMessage(message);
}

/** Cross-tab ONLY — for changes that arrived FROM outside (a pull applying
 *  server records). Skipping the local handlers matters: routing a pull
 *  through them re-marked every pulled id dirty and echoed a full redundant
 *  re-push after every sync round. */
export function broadcastRemote(message: DbChangeMessage): void {
  channel?.postMessage(message);
}

export function onDbChange(handler: (message: DbChangeMessage) => void): void {
  channel?.addEventListener('message', (event) => handler(event.data as DbChangeMessage));
}
