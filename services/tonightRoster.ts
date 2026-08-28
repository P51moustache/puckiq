/**
 * Tonight status for MY roster from public NHL APIs (api-web.nhle.com).
 * Opponent from daily score; scratch from gamecenter right-rail.
 */

import type {
  FantasyPlayer,
  InjuryConfidence,
  InjurySignal,
  RosterNewsItem,
  TonightPlayerStatus,
} from '../types/fantasy';
import { nhlWebApiBase, NHL_WEB_API } from '../lib/nhlEndpoints';
import { getNhlCalendarDate } from './nhlDate';
import { newsInjuryHintForPlayer } from './rosterNews';
import { leanStartSit } from './startSitLean';

export { NHL_WEB_API };

interface ScoreTeam {
  abbrev?: string;
}

interface ScoreGame {
  id?: number;
  gameState?: string;
  startTimeUTC?: string;
  homeTeam?: ScoreTeam;
  awayTeam?: ScoreTeam;
}

export interface TonightSlate {
  date: string;
  nextDate?: string;
  games: ScoreGame[];
}

interface ScratchRow {
  id?: number;
}

export function findGameForTeam(games: ScoreGame[], teamAbbrev: string): ScoreGame | null {
  const team = teamAbbrev.toUpperCase();
  return games.find((game) => {
    const home = (game.homeTeam?.abbrev ?? '').toUpperCase();
    const away = (game.awayTeam?.abbrev ?? '').toUpperCase();
    return home === team || away === team;
  }) ?? null;
}

export function extractScratchIds(rightRail: any): Set<number> {
  const ids = new Set<number>();
  const away = rightRail?.gameInfo?.awayTeam?.scratches ?? [];
  const home = rightRail?.gameInfo?.homeTeam?.scratches ?? [];
  for (const row of [...away, ...home] as ScratchRow[]) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return ids;
}

export function buildTonightStatus(
  player: FantasyPlayer,
  game: ScoreGame | null,
  scratchIds: Set<number>,
  news: RosterNewsItem[] = [],
): TonightPlayerStatus {
  const team = player.teamAbbrev.toUpperCase();
  const home = (game?.homeTeam?.abbrev ?? '').toUpperCase();
  const away = (game?.awayTeam?.abbrev ?? '').toUpperCase();
  const hasGame = !!game && (home === team || away === team);
  const isHome = hasGame ? home === team : null;
  const opponentAbbrev = hasGame ? (isHome ? away : home) || null : null;

  let injurySignal: InjurySignal = 'ok';
  let injuryNote: string | null = null;
  let confidence: InjuryConfidence = 'unknown';

  if (hasGame && scratchIds.has(player.playerId)) {
    injurySignal = 'scratch';
    injuryNote = 'Listed as a scratch on the NHL game report';
    confidence = 'confirmed';
  } else {
    const fromNews = newsInjuryHintForPlayer(player, news);
    if (fromNews) {
      injurySignal = fromNews;
      confidence = 'likely';
      injuryNote = fromNews === 'out'
        ? 'Injury language in roster news'
        : fromNews === 'dtd'
          ? 'Day-to-day language in roster news'
          : 'Scratch language in roster news';
    }
  }

  const lean = leanStartSit({
    hasGameTonight: hasGame,
    injurySignal,
    isGoalie: player.position === 'G',
    goalieConfirmedStarter: null,
  });

  return {
    playerId: player.playerId,
    playerName: player.playerName,
    teamAbbrev: player.teamAbbrev,
    position: player.position,
    opponentAbbrev,
    isHome,
    gameId: game?.id ?? null,
    startTimeUTC: game?.startTimeUTC ?? null,
    gameState: game?.gameState ?? null,
    injurySignal,
    injuryNote,
    confidence,
    recommendation: lean.recommendation,
    reason: lean.reason,
  };
}

export const CONFIDENCE_LABEL: Record<InjuryConfidence, string> = {
  confirmed: 'Confirmed',
  likely: 'Likely',
  unknown: 'Unknown',
};

export function sortTonightStatuses(rows: TonightPlayerStatus[]): TonightPlayerStatus[] {
  const rank = (row: TonightPlayerStatus) => {
    if (row.injurySignal === 'scratch' || row.injurySignal === 'out') return 0;
    if (row.opponentAbbrev) return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return a.playerName.localeCompare(b.playerName);
  });
}

export async function fetchTonightSlate(date: string = getNhlCalendarDate()): Promise<TonightSlate> {
  const res = await fetch(`${nhlWebApiBase()}/v1/score/${date}`);
  if (!res.ok) {
    throw new Error(`NHL score fetch failed (${res.status})`);
  }
  const payload = await res.json();
  return {
    date: payload.currentDate ?? date,
    nextDate: payload.nextDate,
    games: Array.isArray(payload.games) ? payload.games : [],
  };
}

export async function fetchScratchIdsForGame(gameId: number): Promise<Set<number>> {
  try {
    const res = await fetch(`${nhlWebApiBase()}/v1/gamecenter/${gameId}/right-rail`);
    if (!res.ok) return new Set();
    const payload = await res.json();
    return extractScratchIds(payload);
  } catch {
    return new Set();
  }
}

export async function getTonightStatusesForRoster(
  players: FantasyPlayer[],
  options: { date?: string; news?: RosterNewsItem[] } = {},
): Promise<{ date: string; nextDate?: string; statuses: TonightPlayerStatus[] }> {
  const date = options.date ?? getNhlCalendarDate();
  const news = options.news ?? [];
  if (players.length === 0) {
    return { date, statuses: [] };
  }

  const slate = await fetchTonightSlate(date);
  const rosterTeams = new Set(players.map((p) => p.teamAbbrev.toUpperCase()));
  const relevantGames = slate.games.filter((game) => {
    const home = (game.homeTeam?.abbrev ?? '').toUpperCase();
    const away = (game.awayTeam?.abbrev ?? '').toUpperCase();
    return rosterTeams.has(home) || rosterTeams.has(away);
  });

  const scratchByGame = new Map<number, Set<number>>();
  await Promise.all(relevantGames.map(async (game) => {
    if (!game.id) return;
    scratchByGame.set(game.id, await fetchScratchIdsForGame(game.id));
  }));

  const statuses = sortTonightStatuses(players.map((player) => {
    const game = findGameForTeam(slate.games, player.teamAbbrev);
    const scratches = game?.id ? (scratchByGame.get(game.id) ?? new Set()) : new Set<number>();
    return buildTonightStatus(player, game, scratches, news);
  }));

  return { date: slate.date, nextDate: slate.nextDate, statuses };
}
