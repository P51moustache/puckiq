import { isValidSeason } from './season';
export type StatRow = Record<string, any>;
export const numberOrNull = (value: unknown): number | null => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null;
type CountingStats = Partial<Record<'gamesPlayed' | 'goals' | 'assists' | 'points' | 'shots' | 'saves', number | null>>;
/** A known subset cannot exceed its season total. Missing evidence proves nothing. */
export function seasonTotalsConflict(totals: CountingStats, games: CountingStats[]): boolean {
  const gp = numberOrNull(totals.gamesPlayed);
  if (gp !== null && gp < games.length) return true;
  return (['goals', 'assists', 'points', 'shots', 'saves'] as const).some(key => {
    const total = numberOrNull(totals[key]);
    const lowerBound = games.reduce((sum, game) => sum + Math.max(0, numberOrNull(game[key]) ?? 0), 0);
    return total !== null && total < lowerBound;
  });
}
export function latestSeason(rows: StatRow[]): number | null {
  const seasons = rows.map(r => r.season).filter(isValidSeason);
  return seasons.length ? Math.max(...seasons) : null;
}
const counts = ['games_played', 'games_started', 'goals', 'assists', 'points', 'plus_minus', 'pim', 'power_play_goals', 'shorthanded_goals', 'game_winning_goals', 'shots', 'wins', 'losses', 'ot_losses', 'shots_against', 'saves', 'goals_against', 'shutouts', 'toi_seconds'];
/** Club-stats is regular season. Never mix seasons or sum a total with its splits. */
export function aggregateSeasonRows(rows: StatRow[], season: number): StatRow[] {
  const groups = new Map<number, StatRow[]>();
  for (const r of rows) {
    if (r.season !== season || !isValidSeason(r.season) || (r.game_type != null && r.game_type !== 2))
      continue;
    groups.set(r.player_id, [...(groups.get(r.player_id) ?? []), r]);
  }
  const result: StatRow[] = [];
  for (const splits of groups.values()) {
    const totals = splits.filter(r => /^(TOT|TOTAL|\d+TM)$/.test(r.team_abbrev ?? ''));
    if (totals.length > 1)
      continue;
    const chosen = totals.length ? totals : splits;
    if (new Set(chosen.map(r => r.team_abbrev)).size !== chosen.length)
      continue;
    const out: StatRow = { ...chosen[0], season, game_type: 2 };
    for (const key of counts) {
      const values = chosen.map(r => numberOrNull(r[key]));
      out[key] = values.every(v => v !== null) ? (values as number[]).reduce((a, b) => a + b, 0) : null;
    }
    if (chosen.length > 1) {
      out.team_abbrev = 'TOT';
      // Rates without their denominators cannot be averaged across team splits.
      for (const key of ['avg_toi_per_game', 'faceoff_win_pctg', 'goals_against_avg', 'save_pctg'])
        out[key] = null;
    }
    out.shooting_pctg = out.shots > 0 && out.goals !== null ? out.goals / out.shots : null;
    out.updated_at = chosen.map(r => r.updated_at).filter((d): d is string => typeof d === 'string').sort()[0] ?? null;
    result.push(out);
  }
  return result;
}
export function normalizeCareerTotals(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {};
  const source = (value as StatRow).regularSeason ?? value;
  return Object.fromEntries(Object.entries(source).filter((entry): entry is [
    string,
    number
  ] => typeof entry[1] === 'number' && Number.isFinite(entry[1])));
}
export function scopedGames(rows: StatRow[], season: number, cutoff: string): StatRow[] {
  const unique = new Map<number, StatRow>();
  for (const row of rows) {
    const game = Array.isArray(row.games) ? row.games[0] : row.games;
    if (!game || game.season !== season || game.game_type !== 2 || typeof game.game_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(game.game_date) || game.game_date > cutoff.slice(0, 10) || !['OFF', 'FINAL'].includes(game.game_state))
      continue;
    unique.set(row.game_id, { ...row, games: game });
  }
  return [...unique.values()].sort((a, b) => b.games.game_date.localeCompare(a.games.game_date) || b.game_id - a.game_id);
}
