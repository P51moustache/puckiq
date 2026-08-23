/**
 * Host alerts often arrive after lock. We show time until THIS player's game locks.
 * Puck-drop (startTimeUTC) is the lock. We do not invent a host-specific cutoff.
 */

const LOCKED_STATES = new Set(['LIVE', 'CRIT', 'OFF', 'FINAL', 'OVER']);

export function isPlayerLocked(
  startTimeUTC: string | null,
  gameState: string | null = null,
  now: Date = new Date(),
): boolean {
  if (gameState && LOCKED_STATES.has(gameState.toUpperCase())) return true;
  if (!startTimeUTC) return false;
  const lock = Date.parse(startTimeUTC);
  if (!Number.isFinite(lock)) return false;
  return lock <= now.getTime();
}

export function formatLockCountdown(
  startTimeUTC: string | null,
  now: Date = new Date(),
  gameState: string | null = null,
): string | null {
  if (!startTimeUTC && !gameState) return null;
  if (isPlayerLocked(startTimeUTC, gameState, now)) return 'Locked';
  if (!startTimeUTC) return null;

  const lock = Date.parse(startTimeUTC);
  if (!Number.isFinite(lock)) return null;
  const ms = lock - now.getTime();
  if (ms <= 0) return 'Locked';

  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;

  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${mins}m`;
  return `Locks in ${mins}m`;
}
