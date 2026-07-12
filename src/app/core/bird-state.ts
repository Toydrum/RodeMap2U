/** The companion's pose — pure logic, shared by every surface that hosts
 *  the parakeet (timer ring, ahora card, traveling/scene perches). */
export type BirdState = 'working' | 'resting' | 'bloomed' | 'approaching';

/** Default transition-bridge window before the planted time completes.
 *  Since 0.0.68 the user may widen it to 5 min (Settings.bridgeMinutes) —
 *  a hyperfocus exit-ramp; consumers should pass their configured value. */
export const BRIDGE_MS = 2 * 60_000;

export function birdStateFrom(
  paused: boolean,
  overtime: boolean,
  remainingMs: number,
  bridgeMs = BRIDGE_MS,
): BirdState {
  if (paused) return 'resting';
  if (overtime) return 'bloomed';
  return remainingMs <= bridgeMs ? 'approaching' : 'working';
}
