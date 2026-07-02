import { StoreName } from './idb';

/**
 * Cross-tab record refresh. Every mutation posts {store, ids}; other tabs
 * re-read those records and apply them if the incoming rev is newer.
 * This same "apply an external record" path is where Supabase sync plugs
 * into in v2.
 */

export interface DbChangeMessage {
  store: StoreName;
  ids: string[];
}

const CHANNEL_NAME = 'rodemap2u-db';

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

export function broadcastChange(message: DbChangeMessage): void {
  channel?.postMessage(message);
}

export function onDbChange(handler: (message: DbChangeMessage) => void): void {
  channel?.addEventListener('message', (event) => handler(event.data as DbChangeMessage));
}
