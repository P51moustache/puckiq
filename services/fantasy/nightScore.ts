/**
 * A night, scored. Live and final fantasy points for MY players straight from the box score,
 * split by PuckIQ's pre-game lineup (starters vs players with no slot), the night's phase and
 * leader, and — once every game is final — the hindsight check: how much of the best possible
 * lineup (knowing the results) the pre-game lineup captured.
 *
 * Pure. The Tonight screen, the morning recap, the widgets and the Live Activity all render
 * this one result, so they can never disagree.
 */

import type { FantasyPlayer, LineupSlots, ScoringWeights, SlotKey } from '../../types/fantasy';
import type { GameLine } from '../nhl/gamecenter';
import { isGameFinal, isGameStarted, type NhlGame } from '../nhl/schedule';
import { assignLineup } from './lineup';
import { eligibleSlots } from './positions';
import { goaliePoints, skaterPoints } from './scoring';
import type { DayPlan } from './weekPlan';

export type NightPhase = 'pre' | 'live' | 'final';
export type PlayerNightState = 'upcoming' | 'live' | 'final';
/** Moments every hockey fan reads the same way, independent of league scoring. */
export type BigNight = 'hat-trick' | 'three-points' | 'shutout' | 'forty-saves';

/** A skater's night is "big" at a hat trick or a three-point night. */
const BIG_NIGHT_POINTS = 3;
const BIG_NIGHT_GOALS = 3;
/** Forty saves is the broadcast's "stood on his head" line. */
const BIG_NIGHT_SAVES = 40;

export const BIG_NIGHT_LABEL: Record<BigNight, string> = {
  'hat-trick': 'HAT TRICK',
  'three-points': '3-POINT NIGHT',
  shutout: 'SHUTOUT',
  'forty-saves': `${BIG_NIGHT_SAVES} SAVES`,
};

export interface PlayerNight {
  playerId: number;
  gameId: number;
  state: PlayerNightState;
  /** Fantasy points so far; null until he shows up in the box score. */
  points: number | null;
  /** Where PuckIQ's pre-game lineup put him. `unplanned` = no lineup to compare (e.g. no DayPlan). */
  role: 'starter' | 'bench' | 'unplanned';
  slot: SlotKey | null;
  bigNight: BigNight | null;
}

export interface Hindsight {
  /** Best lineup value possible, knowing the results. */
  best: number;
  /** What PuckIQ's pre-game lineup scored. */
  captured: number;
  /** captured ÷ best, 0–1 (1 when nobody scored). */
  share: number;
}

export interface NightScore {
  phase: NightPhase;
  /** Every one of my players who played (the free view). */
  totalPoints: number;
  /** PuckIQ's lineup only (the Pro view). */
  starterPoints: number;
  /** Players who played with no slot — points the lineup couldn't use. */
  benchPoints: number;
  /** My playing players by their game's state. */
  live: number;
  final: number;
  upcoming: number;
  /** Highest scorer so far (ties: the starter, then the lower id). */
  top: PlayerNight | null;
  /** Timing-tower order: started players by points, then upcoming by puck drop. */
  players: PlayerNight[];
  /** Only once every one of my games is final and there was a lineup to grade. */
  hindsight: Hindsight | null;
  /** The furthest-along live game, for a single clock ("P2 10:15"). */
  leadGame: NhlGame | null;
}

export interface NightScoreInput {
  players: FantasyPlayer[];
  playerGames: Record<number, { gameId: number; startTimeUTC: string | null } | undefined>;
  /** Tonight's slate with live state (fresher than the per-player copies). */
  games: NhlGame[];
  lines: Map<number, GameLine>;
  scoring: ScoringWeights;
  slots: LineupSlots;
  /** PuckIQ's pre-game lineup for this date; null when it isn't known. */
  day: DayPlan | null;
  /** Confirmed scratches — they don't play, so they don't count anywhere. */
  scratched?: Set<number>;
}

/** "2G · 1A · 4 SOG" or "31 SV · 2 GA" — a box-score line in broadcast shorthand. */
export function lineText(line: GameLine): string {
  if (line.isGoalie) {
    return `${line.saves} SV · ${line.goalsAgainst} GA`;
  }
  const parts: string[] = [];
  if (line.goals) parts.push(`${line.goals}G`);
  if (line.assists) parts.push(`${line.assists}A`);
  if (parts.length === 0) parts.push('0 PTS');
  parts.push(`${line.shots} SOG`);
  if (line.hits) parts.push(`${line.hits} HIT`);
  if (line.blocks) parts.push(`${line.blocks} BLK`);
  return parts.join(' · ');
}

/** "P2 10:15", "INT 1", "OT", "Final" — a game's clock as the broadcast shows it. */
export function gameClockText(game: { state: string; period?: number | null; clock?: string | null; inIntermission?: boolean }): string {
  if (['FINAL', 'OFF', 'OVER'].includes(game.state)) return 'Final';
  if (game.inIntermission) return `INT ${game.period ?? ''}`.trim();
  if (game.period) {
    const label = game.period > 3 ? 'OT' : `P${game.period}`;
    return game.clock ? `${label} ${game.clock}` : label;
  }
  return 'Live';
}

/** Did this player's team win? Only meaningful once the game is final. */
export function teamWon(game: Pick<NhlGame, 'home' | 'away' | 'homeScore' | 'awayScore'>, team: string): boolean {
  if (game.homeScore == null || game.awayScore == null) return false;
  const upper = team.toUpperCase();
  const mine = game.home === upper ? game.homeScore : game.awayScore;
  const theirs = game.home === upper ? game.awayScore : game.homeScore;
  return mine > theirs;
}

/**
 * Fantasy points from one box-score line. Box scores don't carry power-play assists, so PPP is
 * power-play goals. A goalie's win (and a shutout: a win with no goals against) only counts
 * once the game is final.
 */
export function linePoints(line: GameLine, scoring: ScoringWeights, opts: { final?: boolean; won?: boolean } = {}): number {
  if (line.isGoalie) {
    const won = !!opts.final && !!opts.won;
    return goaliePoints(
      { wins: won ? 1 : 0, saves: line.saves, goalsAgainst: line.goalsAgainst, shutouts: won && line.goalsAgainst === 0 ? 1 : 0 },
      scoring,
    );
  }
  return skaterPoints(
    {
      goals: line.goals,
      assists: line.assists,
      ppp: line.powerPlayGoals,
      shots: line.shots,
      hits: line.hits,
      blocks: line.blocks,
      plusMinus: line.plusMinus,
    },
    scoring,
  );
}

export function bigNightOf(line: GameLine | undefined, final: boolean, won: boolean): BigNight | null {
  if (!line) return null;
  if (line.isGoalie) {
    if (final && won && line.goalsAgainst === 0) return 'shutout';
    return line.saves >= BIG_NIGHT_SAVES ? 'forty-saves' : null;
  }
  if (line.goals >= BIG_NIGHT_GOALS) return 'hat-trick';
  return line.goals + line.assists >= BIG_NIGHT_POINTS ? 'three-points' : null;
}

/** Players whose goal count went up between two refreshes — for the goal haptic. */
export function newGoalScorers(before: Map<number, GameLine>, after: Map<number, GameLine>): number[] {
  const out: number[] = [];
  for (const [id, line] of after) {
    if (line.isGoalie) continue;
    const prior = before.get(id);
    // A first sighting isn't "new" — the app may just have opened mid-game.
    if (prior && line.goals > prior.goals) out.push(id);
  }
  return out;
}

function stateOf(game: NhlGame | undefined): PlayerNightState {
  if (!game || !isGameStarted(game)) return 'upcoming';
  return isGameFinal(game) ? 'final' : 'live';
}

/** Later period first, then less time left on the clock. */
function furthestAlong(games: NhlGame[]): NhlGame | null {
  const live = games.filter((game) => isGameStarted(game) && !isGameFinal(game));
  if (live.length === 0) return null;
  const remaining = (clock: string | null) => {
    if (!clock) return Number.POSITIVE_INFINITY;
    const [m, s] = clock.split(':').map(Number);
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
  };
  return [...live].sort((a, b) => (b.period ?? 0) - (a.period ?? 0) || remaining(a.clock) - remaining(b.clock))[0];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The one number a night leads with: the lineup's points for Pro (it's what counted), every
 * player's points for free (no lineup to split by). Hero, recap, widget and Live Activity all
 * use this rule.
 */
export function headlinePoints(score: NightScore, isPro: boolean): number {
  return isPro && score.players.some((row) => row.role === 'starter') ? score.starterPoints : score.totalPoints;
}

export function buildNightScore(input: NightScoreInput): NightScore {
  const { players, playerGames, games, lines, scoring, slots, day } = input;
  const scratched = input.scratched ?? new Set<number>();
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const starters = new Map((day?.starters ?? []).map((seat) => [seat.playerId, seat.slot]));
  const bench = new Set(day?.bench ?? []);

  const rows: PlayerNight[] = [];
  const startByPlayer = new Map<number, string>();
  for (const player of players) {
    if (player.injuredReserve || scratched.has(player.playerId)) continue;
    const entry = playerGames[player.playerId];
    if (!entry) continue;
    const game = gamesById.get(entry.gameId);
    const state = stateOf(game);
    const final = state === 'final';
    const won = final && !!game && teamWon(game, player.teamAbbrev);
    const line = lines.get(player.playerId);
    startByPlayer.set(player.playerId, entry.startTimeUTC ?? '');
    rows.push({
      playerId: player.playerId,
      gameId: entry.gameId,
      state,
      points: line && state !== 'upcoming' ? round1(linePoints(line, scoring, { final, won })) : null,
      role: !day ? 'unplanned' : starters.has(player.playerId) ? 'starter' : bench.has(player.playerId) ? 'bench' : 'unplanned',
      slot: starters.get(player.playerId) ?? null,
      bigNight: state === 'upcoming' ? null : bigNightOf(line, final, won),
    });
  }

  const sum = (filter: (row: PlayerNight) => boolean) => round1(rows.filter(filter).reduce((total, row) => total + (row.points ?? 0), 0));
  const live = rows.filter((row) => row.state === 'live').length;
  const final = rows.filter((row) => row.state === 'final').length;
  const upcoming = rows.filter((row) => row.state === 'upcoming').length;
  const phase: NightPhase = live + final === 0 ? 'pre' : upcoming === 0 && live === 0 ? 'final' : 'live';

  const ordered = [...rows].sort((a, b) => {
    const aStarted = a.state !== 'upcoming';
    const bStarted = b.state !== 'upcoming';
    if (aStarted !== bStarted) return aStarted ? -1 : 1;
    if (aStarted) {
      return (b.points ?? -1) - (a.points ?? -1) || (a.state === 'live' ? -1 : 0) - (b.state === 'live' ? -1 : 0) || a.playerId - b.playerId;
    }
    return (startByPlayer.get(a.playerId) ?? '').localeCompare(startByPlayer.get(b.playerId) ?? '') || a.playerId - b.playerId;
  });

  const scored = rows.filter((row) => row.points !== null);
  const top = scored.length === 0
    ? null
    : [...scored].sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (a.role === 'starter' ? -1 : 0) - (b.role === 'starter' ? -1 : 0) || a.playerId - b.playerId)[0];

  const starterPoints = sum((row) => row.role === 'starter');
  let hindsight: Hindsight | null = null;
  if (phase === 'final' && day) {
    const byId = new Map(players.map((player) => [player.playerId, player]));
    const best = assignLineup(
      rows.map((row) => ({ playerId: row.playerId, slots: eligibleSlots(byId.get(row.playerId)!), value: row.points ?? 0 })),
      slots,
    );
    const pointsById = new Map(rows.map((row) => [row.playerId, row.points ?? 0]));
    const bestTotal = round1(best.starters.reduce((total, seat) => total + (pointsById.get(seat.playerId) ?? 0), 0));
    hindsight = {
      best: bestTotal,
      captured: starterPoints,
      share: bestTotal > 0 ? Math.min(1, Math.max(0, starterPoints / bestTotal)) : 1,
    };
  }

  return {
    phase,
    totalPoints: sum(() => true),
    starterPoints,
    benchPoints: sum((row) => row.role === 'bench'),
    live,
    final,
    upcoming,
    top: top && (top.points ?? 0) > 0 ? top : null,
    players: ordered,
    hindsight,
    leadGame: furthestAlong(games.filter((game) => rows.some((row) => row.gameId === game.id))),
  };
}
