/** Transparent player projections and opponent-strength assessments; no invented confidence. */
import { blendedPace, type PlayerForm } from './form';
import type { NhlGame } from '../nhl/schedule';
import { isGameStarted, opponentOf } from '../nhl/schedule';
import type { TeamStrength } from '../nhl/teams';
import { MATCHUP_TOP_RANK, MATCHUP_BOTTOM_RANK } from './matchupTag';

export interface ProjectionMetric {
  label: string;
  value: number;
}
export interface SeasonEstimate {
  games: number;
  metrics: ProjectionMetric[];
  basis: string;
}
const RECENT_WEIGHT = 0.35;
const MIN_RECENT_GAMES = 3;

/** Excludes already-started games, including today's live game. */
export function remainingTeamGames(
  schedule: NhlGame[],
  today: string,
  now: number,
): NhlGame[] {
  return schedule.filter(
    (g) =>
      g.date >= today &&
      !isGameStarted(g) &&
      (!g.startTimeUTC || Date.parse(g.startTimeUTC) > now),
  );
}

export function estimateRemainingSeason(
  form: PlayerForm | null,
  games: number,
): SeasonEstimate | null {
  if (!form?.season || form.basis === 'none' || games <= 0) return null;
  const season = form.season;
  const goalie = 'gs' in season;
  const denominator = goalie ? season.gs : season.gp;
  if (denominator <= 0) return null;
  const expectedGames = goalie
    ? games * Math.max(0, Math.min(1, form.startShare))
    : games;
  const recent = form.recent;
  const recentGp = recent ? ('gs' in recent ? recent.gs : recent.gp) : 0;
  const blend = (key: string) => {
    const total = Number(
      (season as unknown as Record<string, number>)[key] ?? 0,
    );
    const previous = form.previous;
    const priorGp = previous
      ? 'gs' in previous
        ? previous.gs
        : previous.gp
      : 0;
    const priorRate =
      priorGp > 0 && previous
        ? Number((previous as unknown as Record<string, number>)[key] ?? 0) /
          priorGp
        : null;
    const base =
      form.basis === 'blended' && priorRate !== null
        ? blendedPace(total, denominator, priorRate)
        : total / denominator;
    const recentRate =
      recentGp >= MIN_RECENT_GAMES && recent
        ? Number((recent as unknown as Record<string, number>)[key] ?? 0) /
          recentGp
        : null;
    return Math.round(
      (recentRate === null
        ? base
        : base * (1 - RECENT_WEIGHT) + recentRate * RECENT_WEIGHT) *
        expectedGames,
    );
  };
  const keys = goalie
    ? [
        ['wins', 'Wins'],
        ['saves', 'Saves'],
        ['shutouts', 'Shutouts'],
      ]
    : [
        ['goals', 'Goals'],
        ['assists', 'Assists'],
      ];
  const metrics = keys.map(([key, label]) => ({ label, value: blend(key) }));
  if (!goalie)
    metrics.push({
      label: 'Points',
      value: metrics[0].value + metrics[1].value,
    });
  return {
    games: expectedGames,
    metrics,
    basis: `${form.basis === 'previous' ? 'Last-season' : form.basis === 'blended' ? 'Season + prior-season' : 'Season'} pace${recentGp >= MIN_RECENT_GAMES ? ' blended with recent form' : ''}; ${games} scheduled games remain${goalie ? ', adjusted for start share' : ''}. Estimates assume availability.`,
  };
}

export interface MatchupAssessment {
  stars: number | null;
  label: string;
  rank: number | null;
}
/** Five bands over the NHL's 32 teams; high is favorable for this player's position. */
export function assessMatchup(
  opponent: TeamStrength | undefined,
  goalie: boolean,
): MatchupAssessment {
  if (!opponent) return { stars: null, label: 'Not enough data', rank: null };
  const rank = goalie ? opponent.offenseRank : opponent.matchupRank;
  if (!Number.isFinite(rank) || rank < 1 || rank > 32)
    return { stars: null, label: 'Not enough data', rank: null };
  const favorableRank = goalie ? 33 - rank : rank;
  return {
    stars: Math.max(1, 5 - Math.floor((favorableRank - 1) / 6.4)),
    rank,
    label:
      favorableRank <= MATCHUP_TOP_RANK
        ? 'Favorable'
        : favorableRank >= MATCHUP_BOTTOM_RANK
          ? 'Tough'
          : 'Balanced',
  };
}

export function upcomingAssessments(
  games: NhlGame[],
  team: string,
  strength: ReadonlyMap<string, TeamStrength>,
  goalie: boolean,
) {
  return games.slice(0, 5).map((game) => ({
    game,
    ...opponentOf(game, team),
    ...assessMatchup(strength.get(opponentOf(game, team).opponent), goalie),
  }));
}
