/**
 * Goalie rate helpers.
 *
 * `goalie_season_stats.save_pctg`, `goals_against_avg`, and their `season_*`
 * variants are NULL in the database — only the raw counting stats (saves,
 * shots_against, goals_against, time_on_ice_seconds, games_played) are populated.
 * These helpers derive the rate stats so the UI shows real numbers instead of 0.
 */

export interface GoalieCountingStats {
  save_pctg?: number | null;
  saves?: number | null;
  shots_against?: number | null;
  goals_against?: number | null;
  toi_seconds?: number | null;
  games_played?: number | null;
}

/**
 * Save percentage as a 0–1 decimal (e.g. 0.920). Uses the stored `save_pctg`
 * when the DB actually has it; otherwise (the usual case — the column is NULL)
 * derives it from shots_against, falling back to saves + goals_against (which
 * equals shots faced). Returns null when there is no shot volume to compute from.
 */
export function computeSavePct(row?: GoalieCountingStats | null): number | null {
  if (!row) return null;
  if (row.save_pctg != null) return row.save_pctg;
  const saves = row.saves ?? 0;
  const shotsAgainst = row.shots_against ?? 0;
  if (shotsAgainst > 0) return saves / shotsAgainst;
  const faced = saves + (row.goals_against ?? 0);
  if (faced > 0) return saves / faced;
  return null;
}

/**
 * Goals-against average (goals per 60 minutes). Uses time on ice when available;
 * falls back to goals per game. Returns null when neither is available.
 */
export function computeGaa(row?: GoalieCountingStats | null): number | null {
  if (!row) return null;
  const ga = row.goals_against ?? 0;
  const toi = row.toi_seconds ?? 0;
  if (toi > 0) return (ga * 3600) / toi;
  const gp = row.games_played ?? 0;
  if (gp > 0) return ga / gp;
  return null;
}
