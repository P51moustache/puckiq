/**
 * Date label utilities for game cards.
 * Converts a game date string (YYYY-MM-DD or ISO 8601) into a human-readable
 * relative label like "Today", "Tomorrow", or "Sat, Feb 8".
 */

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns a relative date label for the given game date.
 * @param gameDateOrISO - Either "YYYY-MM-DD" or a full ISO timestamp
 * @returns "Today", "Tomorrow", or a formatted date like "Sat, Feb 8"
 */
export function getRelativeDateLabel(gameDateOrISO: string): string {
  // Extract just the date portion if it's a full ISO timestamp
  const dateStr = gameDateOrISO.length > 10 ? gameDateOrISO.slice(0, 10) : gameDateOrISO;

  const now = new Date();
  const todayStr = toDateString(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateString(tomorrow);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';

  // Parse the date string as local date
  const [year, month, day] = dateStr.split('-').map(Number);
  const gameDate = new Date(year, month - 1, day);

  return gameDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
