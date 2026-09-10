/** NHL season identifier; July 1 UTC is the reporting rollover. */
export function getCurrentSeason(date: Date = new Date()): number {
  const start = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
  return start * 10000 + start + 1;
}
export function isValidSeason(season: unknown): season is number {
  if (typeof season !== 'number' || !Number.isInteger(season))
    return false;
  const start = Math.floor(season / 10000);
  return start >= 1917 && start <= 2200 && season % 10000 === start + 1;
}
export function formatSeasonLabel(season: number): string {
  return isValidSeason(season) ? `${Math.floor(season / 10000)}–${String(season % 10000).slice(-2)}` : 'Season unavailable';
}
