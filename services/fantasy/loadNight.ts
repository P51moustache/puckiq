/** Night-specific orchestration, with explicit freshness and coverage for safety checks. */
import type { FantasyPlayer, InjuryConfidence, InjurySignal, RosterNewsItem } from '../../types/fantasy';
import { addDays } from '../nhl/dates';
import { fetchScratchIdsWithSource, type GameLine } from '../nhl/gamecenter';
import { fetchScoringLines } from '../nhl/powerPlay';
import { fetchDaySlateWithSource, findNextFantasyDate, gameForTeam, isFantasyGame, isGameFinal, isGameStarted, opponentOf, PRESEASON, type NhlGame } from '../nhl/schedule';
import { ESPN_NHL_RSS_URL, fetchRosterNewsWithSource, newsInjuryHintForPlayer } from '../rosterNews';
import { sourceState, unavailableCheck, type Sourced } from '../data/sourceCheck';
import type { PlayerStatus } from './coach';
import { currentStatuses, type LineupChecks } from './lineupChecks';
import { isNhlLinked } from './positions';
import type { PlayerGameDay } from './weekPlan';

export interface NightData {
  date: string;
  checks: LineupChecks;
  games: NhlGame[];
  playerGames: Record<number, PlayerGameDay | undefined>;
  statuses: Map<number, PlayerStatus>;
  liveLines: Map<number, GameLine>;
  news: RosterNewsItem[];
  /** Next date any fantasy game is played, when this night has none. */
  nextDate: string | null;
  /** Exhibition games on this date — they don't count, but say so instead of "no games". */
  preseasonGames: number;
}

/** Players whose game on this night has started (live or final): too late to start or sit them. */
export function startedPlayerIds(night: Pick<NightData, 'games' | 'playerGames'>): Set<number> {
  const games = new Map(night.games.map((game) => [game.id, game]));
  const ids = new Set<number>();
  for (const [id, day] of Object.entries(night.playerGames)) {
    if (day && isGameStarted(games.get(day.gameId) ?? day)) ids.add(Number(id));
  }
  return ids;
}

export function statusFor(
  player: FantasyPlayer,
  hasGame: boolean,
  scratchIds: Set<number>,
  news: RosterNewsItem[],
): PlayerStatus {
  if (hasGame && scratchIds.has(player.playerId)) {
    return { playerId: player.playerId, signal: 'scratch', confidence: 'confirmed', note: 'On the NHL scratch list' };
  }
  const hint = newsInjuryHintForPlayer(player, news);
  if (hint) {
    const note: Record<InjurySignal, string> = {
      out: 'Recent injury report — verify before lineup lock',
      dtd: 'Recent day-to-day report — verify before lineup lock',
      scratch: 'Recent scratch report — verify before lineup lock',
      ok: '',
      unknown: '',
    };
    return { playerId: player.playerId, signal: hint, confidence: 'likely' as InjuryConfidence, note: note[hint] };
  }
  return { playerId: player.playerId, signal: 'ok', confidence: 'unknown', note: null };
}

export async function loadNight(
  players: FantasyPlayer[],
  date: string,
  options: { force?: boolean; live?: boolean; news?: boolean } = {},
): Promise<NightData> {
  const linked = players.filter((player) => isNhlLinked(player) && player.teamAbbrev);
  // Injury news only matters before a night is played; the recap of last night skips it.
  const wantNews = options.news !== false && linked.length > 0;
  const [slateResult, newsResult] = await Promise.all([
    fetchDaySlateWithSource(date, { force: options.force }),
    wantNews ? fetchRosterNewsWithSource(linked, { force: options.force })
      .catch(() => ({ data: [] as RosterNewsItem[], check: unavailableCheck(ESPN_NHL_RSS_URL) })) : Promise.resolve(null),
  ]);
  const slate = slateResult.data;
  const news = newsResult?.data ?? [];
  const games = slate.filter(isFantasyGame);

  const playerGames: Record<number, PlayerGameDay | undefined> = {};
  const relevant = new Map<number, NhlGame>();
  for (const player of linked) {
    const game = gameForTeam(games, player.teamAbbrev);
    if (!game) continue;
    const { opponent, isHome } = opponentOf(game, player.teamAbbrev);
    playerGames[player.playerId] = {
      date,
      gameId: game.id,
      opponent,
      isHome,
      startTimeUTC: game.startTimeUTC,
      state: game.state,
      offNight: games.length <= 7,
    };
    relevant.set(game.id, game);
  }

  const scratchByGame = new Map<number, Sourced<Set<number>>>();
  const linesByGame = new Map<number, Map<number, GameLine>>();
  await Promise.all([...relevant.values()].map(async (game) => {
    if (!isGameFinal(game)) scratchByGame.set(game.id, await fetchScratchIdsWithSource(game.id, { force: options.force }));
    if (options.live !== false && isGameStarted(game)) {
      linesByGame.set(game.id, await fetchScoringLines(game.id, { final: isGameFinal(game), force: options.force }));
    }
  }));

  const statuses = new Map<number, PlayerStatus>();
  const liveLines = new Map<number, GameLine>();
  for (const player of linked) {
    const game = playerGames[player.playerId];
    const scratch = game ? scratchByGame.get(game.gameId) : undefined;
    const freshScratch = scratch && sourceState(scratch.check, Date.now()) === 'fresh';
    const status = statusFor(player, !!game, scratch?.data ?? new Set(), news);
    status.check = status.confidence === 'confirmed' || status.signal === 'ok' ? scratch?.check : newsResult?.check;
    // Cached/unpublished scratch data is not a current confirmed absence or an all-clear.
    if (status.signal === 'ok' && (!freshScratch || newsResult && sourceState(newsResult.check, Date.now()) !== 'fresh')) {
      status.signal = 'unknown';
    }
    statuses.set(player.playerId, status);
    const line = game ? linesByGame.get(game.gameId)?.get(player.playerId) : undefined;
    if (line) liveLines.set(player.playerId, line);
  }

  const anyGame = Object.keys(playerGames).length > 0;
  const nextDate = anyGame ? null : await findNextFantasyDate(addDays(date, 1)).catch(() => null);

  const preseasonGames = slate.filter((game) => game.gameType === PRESEASON && game.scheduleState === 'OK').length;

  const checks: LineupChecks = {
    schedule: slateResult.check,
    scratches: [...scratchByGame.values()].map((result) => result.check),
    news: newsResult?.check ?? null,
  };
  return { date, checks, games, playerGames, statuses: currentStatuses(statuses, Date.now()), liveLines, news, nextDate, preseasonGames };
}

