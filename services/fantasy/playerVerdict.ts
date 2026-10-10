/**
 * The player card's verdict: one short call about his next game and one or two plain reasons.
 *
 * Built only from signals the app already has: his team's week (schedule), opponent strength
 * (the same matchup tags as Tonight), his trend and game log, and, for my own players, tonight's
 * NHL status and best lineup. Free users already see matchup tags, hot/cold, scratches and
 * injury news, so those are always fair game. The lineup slot or bench call and goalie start
 * share are Pro: they only appear when `isPro`. No odds, no betting language.
 */

import type { SlotKey } from '../../types/fantasy';
import { addDays, formatPuckDrop } from '../nhl/dates';
import type { GameLogRow } from '../nhl/player';
import { fantasyGamesOn, gameForTeam, isGameStarted, isOffNight, opponentOf, type NhlGame, type WeekSchedule } from '../nhl/schedule';
import type { TeamStrength } from '../nhl/teams';
import type { PlayerStatus } from './coach';
import type { PlayerForm } from './form';
import { MATCHUP_TOP_RANK, matchupTagFor } from './matchupTag';

/** A verdict stays a glance: the call plus at most this many reasons. */
export const MAX_REASONS = 2;
/** "His last 5": the same games a free user sees at the top of the game log. */
export const RECENT_GAMES = 5;
/** News-only signals (not the NHL's scratch sheet) that mean "check him before lock". */
const NEWS_SIGNALS: PlayerStatus['signal'][] = ['out', 'dtd', 'scratch'];

export interface PlayerWeekGame {
  opponent: string;
  isHome: boolean;
  startTimeUTC: string | null;
  /** Tonight's game is under way or over. Later dates never are (as in Pickups). */
  started: boolean;
}

export interface PlayerWeekDay {
  date: string;
  dayAbbrev: string;
  /** His team's fantasy game that day, if any. */
  game: PlayerWeekGame | null;
  offNight: boolean;
  past: boolean;
}

/** His team's fantasy games this week, one entry per day. Empty when he has no NHL team. */
export function playerWeek(schedule: WeekSchedule, team: string, today: string, now: number): PlayerWeekDay[] {
  if (!team) return [];
  return schedule.days.map((day) => {
    const game = gameForTeam(fantasyGamesOn(day), team);
    return {
      date: day.date,
      dayAbbrev: day.dayAbbrev,
      game: game ? weekGame(game, team, day.date === today, now) : null,
      offNight: isOffNight(day),
      past: day.date < today,
    };
  });
}

function weekGame(game: NhlGame, team: string, isToday: boolean, now: number): PlayerWeekGame {
  const { opponent, isHome } = opponentOf(game, team);
  // The schedule is cached for hours, so a passed puck drop also counts as started.
  const start = game.startTimeUTC ? Date.parse(game.startTimeUTC) : Number.NaN;
  const started = isToday && (isGameStarted(game) || (Number.isFinite(start) && start <= now));
  return { opponent, isHome, startTimeUTC: game.startTimeUTC, started };
}

export type VerdictKind = 'start' | 'sit' | 'scratched' | 'check' | 'ir' | 'plays' | 'off' | 'locked' | 'none';
export type VerdictTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface PlayerVerdict {
  kind: VerdictKind;
  tone: VerdictTone;
  /** When and against whom: "Tonight · 7:00 PM vs MTL", "Next game · Thu @ BOS", "This week". */
  when: string;
  /** The call: "Start him", "Plays tonight", "Off tonight". */
  call: string;
  /** At most MAX_REASONS short lines, most important first. */
  reasons: string[];
}

/** Tonight's facts for a player on my roster (from useNight). */
export interface RosterTonight {
  injuredReserve: boolean;
  status?: PlayerStatus;
  /** His slot in tonight's best lineup. Pro: the verdict only uses it when `isPro`. */
  slot?: SlotKey;
  /** He plays tonight but every slot he fits holds a higher-value player. Pro, like `slot`. */
  benched?: boolean;
}

export interface VerdictInput {
  week: PlayerWeekDay[];
  today: string;
  goalie: boolean;
  form: PlayerForm | null;
  /** Opponent strength by team (Tonight's team forms). Missing: no matchup reason. */
  strength?: Map<string, TeamStrength>;
  /** This season's games, newest first. Empty when unknown or only last season's. */
  log: GameLogRow[];
  isPro: boolean;
  /** Only when he's on my roster. */
  roster?: RosterTonight;
}

/** The call on his next game this week, or null when he has no week to judge (no team, no schedule). */
export function buildPlayerVerdict(input: VerdictInput): PlayerVerdict | null {
  if (input.week.length === 0) return null;
  const upcoming = input.week.filter((day) => !day.past && day.game !== null && !day.game.started);
  const form = formReason(input.form, input.log, input.goalie);
  const next = upcoming[0];
  if (!next?.game) {
    const hadGames = input.week.some((day) => day.game !== null);
    return verdict('none', 'neutral', 'This week', hadGames ? 'No more games' : 'No games', [form]);
  }

  const matchup = matchupReason(next.game.opponent, input.goalie, input.strength);
  const left = gamesLeftReason(upcoming.length);
  if (next.date !== input.today) {
    const when = `Next game · ${dayName(next, input.today)} ${sideOf(next.game)}`;
    // A game today that isn't "next" has already started: his night is locked, not off.
    const playedToday = input.week.some((day) => day.date === input.today && day.game !== null);
    return playedToday
      ? verdict('locked', 'neutral', when, 'Locked tonight', [left, matchup, form])
      : verdict('off', 'neutral', when, 'Off tonight', [left, matchup, form]);
  }
  return tonightVerdict(input, next.game, [matchup, form, upcoming.length > 1 ? left : null]);
}

function tonightVerdict(input: VerdictInput, game: PlayerWeekGame, general: (string | null)[]): PlayerVerdict {
  const time = formatPuckDrop(game.startTimeUTC);
  const when = `Tonight · ${time === 'TBD' ? '' : `${time} `}${sideOf(game)}`;
  const { roster, isPro, goalie, form } = input;
  const status = roster?.status;
  if (roster?.injuredReserve) {
    return verdict('ir', 'neutral', when, 'On your IR', ['IR players don’t count toward your lineup']);
  }
  if (status?.signal === 'scratch' && status.confidence === 'confirmed') {
    return verdict('scratched', 'bad', when, 'Scratched', ['On the NHL scratch list', 'Bench him in your league']);
  }
  if (status?.confidence === 'likely' && NEWS_SIGNALS.includes(status.signal)) {
    return verdict('check', 'warn', when, 'Check before lock', [status.note || 'Injury news today', 'Not confirmed by the NHL yet']);
  }
  // Start share is Pro (Tonight's lineup, Last 14 days), so only Pro reads it here.
  const share = isPro && goalie && form ? `Starter not announced · he’s started ${Math.round(form.startShare * 100)}% of games` : null;
  if (isPro && roster?.slot) {
    return verdict('start', 'good', when, 'Start him', [`In your best lineup at ${roster.slot}`, share, ...general]);
  }
  if (isPro && roster?.benched) {
    return verdict('sit', 'warn', when, 'Sit him', ['His slots are full with higher-value players', ...general]);
  }
  return verdict('plays', 'neutral', when, goalie ? 'Team plays tonight' : 'Plays tonight', [share, ...general]);
}

function verdict(kind: VerdictKind, tone: VerdictTone, when: string, call: string, reasons: (string | null)[]): PlayerVerdict {
  return { kind, tone, when, call, reasons: reasons.filter((reason): reason is string => !!reason).slice(0, MAX_REASONS) };
}

function sideOf(game: PlayerWeekGame): string {
  return `${game.isHome ? 'vs' : '@'} ${game.opponent}`;
}

/** "Tomorrow", else the weekday: "Thu". */
function dayName(day: PlayerWeekDay, today: string): string {
  if (day.date === addDays(today, 1)) return 'Tomorrow';
  return `${day.dayAbbrev.slice(0, 1)}${day.dayAbbrev.slice(1).toLowerCase()}`;
}

function gamesLeftReason(count: number): string {
  return `${count} ${count === 1 ? 'game' : 'games'} left this week`;
}

/** "Soft matchup: MTL allows the 3rd-most goals" — the reason behind Tonight's SOFT D / TOUGH O tags. */
export function matchupReason(opponent: string, goalie: boolean, strength?: Map<string, TeamStrength>): string | null {
  const ranks = strength?.get(opponent);
  const tag = matchupTagFor({ isGoalie: goalie }, ranks);
  if (!strength || !ranks || !tag) return null;
  // Rank 1 = most goals (allowed, for skaters; scored, for goalies).
  const rank = goalie ? ranks.offenseRank : ranks.matchupRank;
  const most = rank <= MATCHUP_TOP_RANK;
  const place = most ? rank : Math.max(1, strength.size - rank + 1);
  const extreme = `${place === 1 ? '' : `${ordinal(place)}-`}${most ? 'most' : 'fewest'}`;
  return `${tag.tone === 'good' ? 'Soft' : 'Tough'} matchup: ${opponent} ${goalie ? 'scores' : 'allows'} the ${extreme} goals`;
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** Hot/cold (free on Tonight) told through his last games: "Hot: 7 pts in his last 5 games". */
export function formReason(form: Pick<PlayerForm, 'trend'> | null, log: GameLogRow[], goalie: boolean): string | null {
  const recent = recentLine(log, goalie);
  if (form?.trend === 'hot') return `Hot: ${recent ?? 'above his season pace lately'}`;
  if (form?.trend === 'cold') return `Cold: ${recent ?? 'below his season pace lately'}`;
  return recent;
}

/** Points in his last games (skaters) or wins in his last starts (goalies). */
function recentLine(log: GameLogRow[], goalie: boolean): string | null {
  const games = (goalie ? log.filter((row) => row.started) : log).slice(0, RECENT_GAMES);
  const count = games.length;
  if (count === 0) return null;
  const unit = goalie ? 'start' : 'game';
  const span = count === 1 ? `his last ${unit}` : `his last ${count} ${unit}s`;
  if (goalie) {
    const wins = games.filter((row) => row.decision === 'W').length;
    return `${wins} ${wins === 1 ? 'win' : 'wins'} in ${span}`;
  }
  const points = games.reduce((sum, row) => sum + row.points, 0);
  return `${points} ${points === 1 ? 'pt' : 'pts'} in ${span}`;
}
