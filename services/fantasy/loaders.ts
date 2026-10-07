/**
 * Async orchestration: turn a team + a date into forms, a week plan, tonight's
 * statuses, and a pickup pool. Kept out of React so it is testable and cacheable.
 */

import type { FantasyPlayer, FantasyTeam, InjuryConfidence, InjurySignal, RosterNewsItem, ScoringWeights } from '../../types/fantasy';
import { addDays, previousSeasonId, seasonIdFor } from '../nhl/dates';
import { fetchGameLines, fetchScratchIds, type GameLine } from '../nhl/gamecenter';
import {
  fetchDaySlate,
  fetchWeekSchedule,
  findNextFantasyDate,
  gameForTeam,
  isFantasyGame,
  isGameFinal,
  isGameStarted,
  opponentOf,
  PRESEASON,
  type NhlGame,
  type WeekSchedule,
} from '../nhl/schedule';
import { fetchGoalieLines, fetchPlayerBios, fetchSkaterLines, type GoalieLine, type PlayerBio, type SkaterLine } from '../nhl/stats';
import { fetchTeamStrength, type TeamStrength } from '../nhl/teams';
import { fetchRosterNews, newsInjuryHintForPlayer } from '../rosterNews';
import type { PlayerStatus } from './coach';
import { buildGoalieForm, buildSkaterForm, type PlayerForm } from './form';
import type { PickupCandidate } from './pickups';
import { isGoalie, isNhlLinked, normalizePosition } from './positions';
import type { PlayerGameDay } from './weekPlan';

const RECENT_DAYS = 14;

export interface FormsResult {
  forms: Map<number, PlayerForm>;
  teamStrength: Map<string, TeamStrength>;
  seasonId: number;
  previousSeasonId: number;
  /** False before opening night — numbers are last season's. */
  hasCurrentSeason: boolean;
}

function byId<T extends { playerId: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.playerId, row]));
}

export async function loadPlayerForms(
  players: FantasyPlayer[],
  scoring: ScoringWeights,
  today: string,
  options: { force?: boolean } = {},
): Promise<FormsResult> {
  const seasonId = seasonIdFor(today);
  const prevId = previousSeasonId(seasonId);
  const from = addDays(today, -RECENT_DAYS);
  const to = addDays(today, -1);
  const linked = players.filter((player) => isNhlLinked(player));
  const goalieIds = linked.filter((player) => isGoalie(player)).map((player) => player.playerId);
  const skaterIds = linked.filter((player) => !isGoalie(player)).map((player) => player.playerId);
  const force = options.force;

  const safe = <T,>(promise: Promise<T[]>): Promise<T[]> => promise.catch((error) => {
    console.warn('[COACH] Stats request failed:', error instanceof Error ? error.message : error);
    return [] as T[];
  });

  const [sCur, sPrev, sRecent, gCur, gPrev, gRecent, teamStrength] = await Promise.all([
    skaterIds.length ? safe(fetchSkaterLines({ seasonId, playerIds: skaterIds, force })) : Promise.resolve([] as SkaterLine[]),
    skaterIds.length ? safe(fetchSkaterLines({ seasonId: prevId, playerIds: skaterIds })) : Promise.resolve([] as SkaterLine[]),
    skaterIds.length ? safe(fetchSkaterLines({ from, to, playerIds: skaterIds, force })) : Promise.resolve([] as SkaterLine[]),
    goalieIds.length ? safe(fetchGoalieLines({ seasonId, playerIds: goalieIds, force })) : Promise.resolve([] as GoalieLine[]),
    goalieIds.length ? safe(fetchGoalieLines({ seasonId: prevId, playerIds: goalieIds })) : Promise.resolve([] as GoalieLine[]),
    goalieIds.length ? safe(fetchGoalieLines({ from, to, playerIds: goalieIds, force })) : Promise.resolve([] as GoalieLine[]),
    fetchTeamStrength(today).catch(() => new Map<string, TeamStrength>()),
  ]);

  const forms = new Map<number, PlayerForm>();
  const [sc, sp, sr] = [byId(sCur), byId(sPrev), byId(sRecent)];
  for (const id of skaterIds) {
    forms.set(id, buildSkaterForm(id, { current: sc.get(id), previous: sp.get(id), recent: sr.get(id) }, scoring));
  }
  const [gc, gp, gr] = [byId(gCur), byId(gPrev), byId(gRecent)];
  const teamOf = new Map(linked.map((player) => [player.playerId, player.teamAbbrev]));
  for (const id of goalieIds) {
    forms.set(id, buildGoalieForm(id, {
      current: gc.get(id),
      previous: gp.get(id),
      recent: gr.get(id),
      teamGamesPlayed: teamStrength.get(teamOf.get(id) ?? '')?.gamesPlayed ?? 0,
    }, scoring));
  }

  return {
    forms,
    teamStrength,
    seasonId,
    previousSeasonId: prevId,
    hasCurrentSeason: sCur.length > 0 || gCur.length > 0,
  };
}

export function valuesOf(forms: Map<number, PlayerForm>): Map<number, number> {
  return new Map([...forms].map(([id, form]) => [id, form.value]));
}

export function startSharesOf(forms: Map<number, PlayerForm>): Map<number, number> {
  return new Map([...forms].filter(([, form]) => form.isGoalie).map(([id, form]) => [id, form.startShare]));
}

// ---------------------------------------------------------------------------
// Tonight
// ---------------------------------------------------------------------------

export interface NightData {
  date: string;
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
      out: 'Injury language in today’s news',
      dtd: 'Day-to-day language in today’s news',
      scratch: 'Scratch language in today’s news',
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
  const [slate, news] = await Promise.all([
    fetchDaySlate(date, { force: options.force }),
    wantNews ? fetchRosterNews(linked).catch(() => [] as RosterNewsItem[]) : Promise.resolve([] as RosterNewsItem[]),
  ]);
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

  const scratchByGame = new Map<number, Set<number>>();
  const linesByGame = new Map<number, Map<number, GameLine>>();
  await Promise.all([...relevant.values()].map(async (game) => {
    if (!isGameFinal(game)) scratchByGame.set(game.id, await fetchScratchIds(game.id, { force: options.force }));
    if (options.live !== false && isGameStarted(game)) {
      linesByGame.set(game.id, await fetchGameLines(game.id, { final: isGameFinal(game), force: options.force }));
    }
  }));

  const statuses = new Map<number, PlayerStatus>();
  const liveLines = new Map<number, GameLine>();
  for (const player of linked) {
    const game = playerGames[player.playerId];
    const scratches = game ? scratchByGame.get(game.gameId) ?? new Set<number>() : new Set<number>();
    statuses.set(player.playerId, statusFor(player, !!game, scratches, news));
    const line = game ? linesByGame.get(game.gameId)?.get(player.playerId) : undefined;
    if (line) liveLines.set(player.playerId, line);
  }

  const anyGame = Object.keys(playerGames).length > 0;
  const nextDate = anyGame ? null : await findNextFantasyDate(addDays(date, 1)).catch(() => null);

  const preseasonGames = slate.filter((game) => game.gameType === PRESEASON && game.scheduleState === 'OK').length;

  return { date, games, playerGames, statuses, liveLines, news, nextDate, preseasonGames };
}

// ---------------------------------------------------------------------------
// Pickup pool
// ---------------------------------------------------------------------------

const POOL_SKATERS = 300;
const POOL_RECENT_SKATERS = 200;
const POOL_GOALIES = 64;

export async function loadPickupPool(
  today: string,
  scoring: ScoringWeights,
  excludeIds: Set<number>,
  options: { force?: boolean } = {},
): Promise<{ candidates: PickupCandidate[]; hasCurrentSeason: boolean; teamStrength: Map<string, TeamStrength> }> {
  const seasonId = seasonIdFor(today);
  const prevId = previousSeasonId(seasonId);
  const from = addDays(today, -RECENT_DAYS);
  const to = addDays(today, -1);
  const force = options.force;
  let failures = 0;
  const safe = <T,>(promise: Promise<T[]>): Promise<T[]> => promise.catch((error) => {
    failures += 1;
    console.warn('[COACH] Stats request failed:', error instanceof Error ? error.message : error);
    return [] as T[];
  });

  const [sRecent, sCur, sPrev, gRecent, gCur, gPrev, teamStrength] = await Promise.all([
    safe(fetchSkaterLines({ from, to, limit: POOL_RECENT_SKATERS, force })),
    safe(fetchSkaterLines({ seasonId, limit: POOL_SKATERS, force })),
    safe(fetchSkaterLines({ seasonId: prevId, limit: POOL_SKATERS })),
    safe(fetchGoalieLines({ from, to, limit: POOL_GOALIES, sortBy: 'gamesStarted', force })),
    safe(fetchGoalieLines({ seasonId, limit: POOL_GOALIES, sortBy: 'gamesStarted', force })),
    safe(fetchGoalieLines({ seasonId: prevId, limit: POOL_GOALIES, sortBy: 'gamesStarted' })),
    fetchTeamStrength(today).catch(() => new Map<string, TeamStrength>()),
  ]);

  const hasCurrentSeason = sCur.length > 0;
  const skaterIds = [...new Set([...sRecent, ...sCur, ...sPrev].map((row) => row.playerId))].filter((id) => !excludeIds.has(id));
  const goalieIds = [...new Set([...gRecent, ...gCur, ...gPrev].map((row) => row.playerId))].filter((id) => !excludeIds.has(id));

  // Players in the recent/last-season pools but outside this season's top rows still have current numbers.
  const curById = byId(sCur);
  const missingCurrent = hasCurrentSeason ? skaterIds.filter((id) => !curById.has(id)) : [];
  // Current team: the bios report for whichever season has rows (trades show up there).
  const bioSeason = hasCurrentSeason ? seasonId : prevId;
  const noBios = (error: unknown) => {
    failures += 1;
    console.warn('[COACH] Bios request failed:', error instanceof Error ? error.message : error);
    return new Map<number, PlayerBio>();
  };
  const [fillCurrent, skaterBios, goalieBios] = await Promise.all([
    missingCurrent.length ? safe(fetchSkaterLines({ seasonId, playerIds: missingCurrent, force })) : Promise.resolve([] as SkaterLine[]),
    fetchPlayerBios(skaterIds, bioSeason, 'skater').catch(noBios),
    fetchPlayerBios(goalieIds, bioSeason, 'goalie').catch(noBios),
  ]);
  const bios = new Map<number, PlayerBio>([...skaterBios, ...goalieBios]);
  for (const row of fillCurrent) curById.set(row.playerId, row);

  const [recentById, prevById] = [byId(sRecent), byId(sPrev)];
  const candidates: PickupCandidate[] = [];
  for (const id of skaterIds) {
    const bio = bios.get(id);
    if (!bio?.team) continue; // unsigned / retired / overseas
    const position = normalizePosition(bio.position) ? bio.position : (curById.get(id) ?? prevById.get(id))?.position ?? '';
    candidates.push({
      playerId: id,
      name: bio.name || (curById.get(id) ?? prevById.get(id) ?? recentById.get(id))?.name || 'Player',
      team: bio.team,
      position,
      form: buildSkaterForm(id, { current: curById.get(id), previous: prevById.get(id), recent: recentById.get(id) }, scoring),
    });
  }

  const [gRecentById, gCurById, gPrevById] = [byId(gRecent), byId(gCur), byId(gPrev)];
  for (const id of goalieIds) {
    const bio = bios.get(id);
    if (!bio?.team) continue;
    candidates.push({
      playerId: id,
      name: bio.name || (gCurById.get(id) ?? gPrevById.get(id))?.name || 'Goalie',
      team: bio.team,
      position: 'G',
      form: buildGoalieForm(id, {
        current: gCurById.get(id),
        previous: gPrevById.get(id),
        recent: gRecentById.get(id),
        teamGamesPlayed: teamStrength.get(bio.team)?.gamesPlayed ?? 0,
      }, scoring),
    });
  }

  if (candidates.length === 0 && failures > 0) {
    throw new Error('NHL stats are busy right now. Pull to refresh in a minute.');
  }
  return { candidates, hasCurrentSeason, teamStrength };
}

export async function loadWeekSchedule(monday: string, options: { force?: boolean } = {}): Promise<WeekSchedule> {
  return fetchWeekSchedule(monday, options);
}

export function playerIdsOf(team: FantasyTeam | null, includeOpponent = false): number[] {
  if (!team) return [];
  const ids = team.players.map((player) => player.playerId);
  if (includeOpponent) ids.push(...team.opponent.map((player) => player.playerId));
  return [...new Set(ids)];
}
