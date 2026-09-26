/**
 * Team strength for matchup context: goals allowed per game, blended with last
 * season early on so a 2-game sample does not call a team the league's worst defense.
 */

import { fetchJson, HOUR } from './client';
import { NHL_WEB_API } from './schedule';

/** Games of last-season prior to blend in. After ~20 games the current season dominates. */
const PRIOR_GAMES = 10;

export interface TeamStrength {
  team: string;
  gamesPlayed: number;
  goalsAgainstPerGame: number;
  goalsForPerGame: number;
  /** 1 = allows the most goals (best matchup for your skaters), 32 = stingiest. */
  matchupRank: number;
  /** 1 = scores the most (worst matchup for your goalie), 32 = weakest offense. */
  offenseRank: number;
}

interface RawStanding {
  teamAbbrev?: { default?: string };
  gamesPlayed?: number;
  goalAgainst?: number;
  goalFor?: number;
}

interface SeasonRow {
  id?: number;
  standingsStart?: string;
  standingsEnd?: string;
}

export function blendTeamStrength(current: RawStanding[], prior: RawStanding[]): TeamStrength[] {
  const priorByTeam = new Map<string, RawStanding>();
  for (const row of prior) {
    const abbrev = row.teamAbbrev?.default?.toUpperCase();
    if (abbrev) priorByTeam.set(abbrev, row);
  }
  const source = current.length > 0 ? current : prior;
  const rows = source
    .map((row) => {
      const team = row.teamAbbrev?.default?.toUpperCase() ?? '';
      const gp = Number(row.gamesPlayed ?? 0);
      const ga = Number(row.goalAgainst ?? 0);
      const gf = Number(row.goalFor ?? 0);
      const before = priorByTeam.get(team);
      const beforeGp = Number(before?.gamesPlayed ?? 0);
      const priorGa = beforeGp > 0 ? Number(before?.goalAgainst ?? 0) / beforeGp : 3.0;
      const priorGf = beforeGp > 0 ? Number(before?.goalFor ?? 0) / beforeGp : 3.0;
      const weight = current.length > 0 ? PRIOR_GAMES : 0;
      const denominator = gp + weight;
      return {
        team,
        gamesPlayed: current.length > 0 ? gp : 0,
        goalsAgainstPerGame: denominator > 0 ? (ga + priorGa * weight) / denominator : priorGa,
        goalsForPerGame: denominator > 0 ? (gf + priorGf * weight) / denominator : priorGf,
        matchupRank: 0,
        offenseRank: 0,
      };
    })
    .filter((row) => row.team);

  const ranked = [...rows].sort((a, b) => b.goalsAgainstPerGame - a.goalsAgainstPerGame);
  ranked.forEach((row, index) => {
    row.matchupRank = index + 1;
  });
  [...rows].sort((a, b) => b.goalsForPerGame - a.goalsForPerGame).forEach((row, index) => {
    row.offenseRank = index + 1;
  });
  return rows;
}

async function fetchStandingsOn(date: string): Promise<RawStanding[]> {
  const payload = await fetchJson<{ standings?: RawStanding[] }>(`${NHL_WEB_API}/v1/standings/${date}`, {
    ttlMs: 6 * HOUR,
    persist: true,
  });
  return payload.standings ?? [];
}

/**
 * Current-season standings on `date` blended with last season's final table.
 * Before opening night the current table is empty and last season is used as-is.
 */
export async function fetchTeamStrength(date: string): Promise<Map<string, TeamStrength>> {
  const seasons = await fetchJson<{ seasons?: SeasonRow[] }>(`${NHL_WEB_API}/v1/standings-season`, {
    ttlMs: 24 * HOUR,
    persist: true,
  });
  const list = (seasons.seasons ?? []).filter((row) => row.standingsEnd);
  const currentSeason = list.find((row) => row.standingsStart && row.standingsStart <= date && (row.standingsEnd as string) >= date);
  const priorSeason = [...list].reverse().find((row) => (row.standingsEnd as string) < date && row !== currentSeason);

  const [current, prior] = await Promise.all([
    currentSeason ? fetchStandingsOn(date).catch(() => []) : Promise.resolve([] as RawStanding[]),
    priorSeason?.standingsEnd ? fetchStandingsOn(priorSeason.standingsEnd).catch(() => []) : Promise.resolve([] as RawStanding[]),
  ]);

  const map = new Map<string, TeamStrength>();
  for (const row of blendTeamStrength(current, prior)) map.set(row.team, row);
  return map;
}
