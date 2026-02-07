/**
 * Tonight's Headline Generator
 * Produces an editorial one-liner from tonight's game data.
 * Priority order: Rivalry > Division Showdown > Revenge > Streak > Rest Mismatch > Momentum > Default
 */

import type { H2HRecord } from '../types/gameResults';
import type { MomentumData } from '../types/edgeStats';

/** Minimal game shape expected from NHL score API or sample data */
interface HeadlineGame {
  homeTeam?: { abbrev?: string; streakCode?: string };
  awayTeam?: { abbrev?: string; streakCode?: string };
}

/** Standings entry shape (NHL API) */
interface StandingsEntry {
  teamAbbrev: string | { default: string };
  divisionName?: string;
  streakCode?: string;
  [key: string]: unknown;
}

interface StandingsData {
  standings?: StandingsEntry[];
}

function getAbbrev(entry: StandingsEntry): string {
  return typeof entry.teamAbbrev === 'string'
    ? entry.teamAbbrev
    : entry.teamAbbrev?.default ?? '';
}

/**
 * Generate a data-driven headline for the Tonight screen.
 * Returns a concise string (target <50 chars, max 60).
 */
export function generateTonightHeadline(
  games: HeadlineGame[],
  standings: StandingsData | null | undefined,
  h2hMap: Map<string, H2HRecord>,
  momentumMap: Map<string, MomentumData>,
  restMap: Map<string, number>,
): string {
  if (!games?.length) return 'No Games Tonight';

  // 1. Rivalry Night: H2H series is tied (2-2, 1-1) or deciding game
  const rivalry = findRivalry(games, h2hMap);
  if (rivalry) return rivalry;

  // 2. Division Showdown: 3+ divisional matchups
  const divisionCount = countDivisionGames(games, standings);
  if (divisionCount >= 3) {
    return `Division Showdown: ${divisionCount} Divisional Battles`;
  }

  // 3. Revenge Game: lopsided H2H (one team leads 3-0 or 3-1)
  const revenge = findRevengeGame(games, h2hMap);
  if (revenge) return revenge;

  // 4. Streak Alert: any team on 5+ game win/loss streak
  const streak = findStreakAlert(games, standings);
  if (streak) return streak;

  // 5. Rest Mismatch: 3+ teams on back-to-backs
  const backToBackCount = countBackToBacks(games, restMap);
  if (backToBackCount >= 3) {
    return `Fatigue Factor: ${backToBackCount} Teams on Back-to-Backs`;
  }

  // 6. Momentum Watch: large momentum gap in a matchup
  const momentumHeadline = findMomentumGap(games, momentumMap);
  if (momentumHeadline) return momentumHeadline;

  // 7. Default
  return `${games.length} Games on the Slate Tonight`;
}

function findRivalry(
  games: HeadlineGame[],
  h2hMap: Map<string, H2HRecord>,
): string | null {
  for (const game of games) {
    const away = game.awayTeam?.abbrev;
    const home = game.homeTeam?.abbrev;
    if (!away || !home) continue;

    const h2h = h2hMap.get(`${away}-${home}`);
    if (!h2h || h2h.games.length < 2) continue;

    // Series is tied
    if (h2h.teamAWins === h2h.teamBWins && h2h.teamAWins >= 1) {
      return `Rivalry Night: ${away}-${home} Series Tied ${h2h.teamAWins}-${h2h.teamBWins}`;
    }
  }
  return null;
}

function countDivisionGames(
  games: HeadlineGame[],
  standings: StandingsData | null | undefined,
): number {
  const entries = standings?.standings ?? [];
  if (!Array.isArray(entries) || entries.length === 0) return 0;

  const teamDiv = new Map<string, string>();
  for (const entry of entries) {
    const abbrev = getAbbrev(entry);
    if (abbrev && entry.divisionName) {
      teamDiv.set(abbrev, entry.divisionName);
    }
  }

  let count = 0;
  for (const game of games) {
    const hDiv = teamDiv.get(game.homeTeam?.abbrev ?? '');
    const aDiv = teamDiv.get(game.awayTeam?.abbrev ?? '');
    if (hDiv && aDiv && hDiv === aDiv) count++;
  }
  return count;
}

function findRevengeGame(
  games: HeadlineGame[],
  h2hMap: Map<string, H2HRecord>,
): string | null {
  for (const game of games) {
    const away = game.awayTeam?.abbrev;
    const home = game.homeTeam?.abbrev;
    if (!away || !home) continue;

    const h2h = h2hMap.get(`${away}-${home}`);
    if (!h2h || h2h.games.length < 2) continue;

    const totalGames = h2h.teamAWins + h2h.teamBWins;
    if (totalGames < 3) continue;

    // One team leads 3-0 or 3-1 — the trailing team wants revenge
    if (h2h.teamAWins >= 3 && h2h.teamBWins <= 1) {
      return `Revenge Game: ${home} Looks to Even vs ${away}`;
    }
    if (h2h.teamBWins >= 3 && h2h.teamAWins <= 1) {
      return `Revenge Game: ${away} Looks to Even vs ${home}`;
    }
  }
  return null;
}

function findStreakAlert(
  games: HeadlineGame[],
  standings: StandingsData | null | undefined,
): string | null {
  const entries = standings?.standings ?? [];
  const streakMap = new Map<string, string>();
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const abbrev = getAbbrev(entry);
      if (abbrev && entry.streakCode) {
        streakMap.set(abbrev, entry.streakCode as string);
      }
    }
  }

  // Also check streakCode on game objects (e.g. from sample data)
  for (const game of games) {
    if (game.homeTeam?.abbrev && game.homeTeam.streakCode) {
      streakMap.set(game.homeTeam.abbrev, game.homeTeam.streakCode);
    }
    if (game.awayTeam?.abbrev && game.awayTeam.streakCode) {
      streakMap.set(game.awayTeam.abbrev, game.awayTeam.streakCode);
    }
  }

  // Find longest win or loss streak >= 5
  let bestTeam = '';
  let bestLen = 0;
  let bestType = '';

  for (const game of games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      const abbrev = team?.abbrev;
      if (!abbrev) continue;
      const code = streakMap.get(abbrev);
      if (!code) continue;

      const type = code.charAt(0); // W or L
      const len = parseInt(code.substring(1), 10);
      if (isNaN(len)) continue;

      if (len >= 5 && len > bestLen) {
        bestLen = len;
        bestTeam = abbrev;
        bestType = type;
      }
    }
  }

  if (bestTeam && bestLen >= 5) {
    const label = bestType === 'W' ? 'Win' : 'Losing';
    return `Streak Alert: ${bestTeam} on ${bestLen}-Game ${label} Streak`;
  }
  return null;
}

function countBackToBacks(
  games: HeadlineGame[],
  restMap: Map<string, number>,
): number {
  let count = 0;
  for (const game of games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      const abbrev = team?.abbrev;
      if (!abbrev) continue;
      const rest = restMap.get(abbrev);
      if (rest !== undefined && rest <= 0) count++;
    }
  }
  return count;
}

function findMomentumGap(
  games: HeadlineGame[],
  momentumMap: Map<string, MomentumData>,
): string | null {
  let bestGap = 0;
  let bestHot = '';
  let bestCold = '';
  let bestHotScore = 0;
  let bestColdScore = 0;

  for (const game of games) {
    const away = game.awayTeam?.abbrev;
    const home = game.homeTeam?.abbrev;
    if (!away || !home) continue;

    const awayMom = momentumMap.get(away);
    const homeMom = momentumMap.get(home);
    if (!awayMom || !homeMom) continue;

    const gap = Math.abs(awayMom.score - homeMom.score);
    if (gap >= 8 && gap > bestGap) {
      bestGap = gap;
      if (awayMom.score > homeMom.score) {
        bestHot = away;
        bestCold = home;
        bestHotScore = awayMom.score;
        bestColdScore = homeMom.score;
      } else {
        bestHot = home;
        bestCold = away;
        bestHotScore = homeMom.score;
        bestColdScore = awayMom.score;
      }
    }
  }

  if (bestHot && bestCold) {
    const hotSign = bestHotScore >= 0 ? '+' : '';
    const coldSign = bestColdScore >= 0 ? '+' : '';
    return `Hot vs Cold: ${bestHot} (${hotSign}${bestHotScore}) vs ${bestCold} (${coldSign}${bestColdScore})`;
  }
  return null;
}
