/**
 * A category league's night: the tallies a host app's matchup screen shows (G, A, +/-, PPP …
 * W, GAA, SV%, SO) for the players the night counts. Pure. Tonight, the recap, the share card
 * and the widgets all read this, so they can never disagree.
 */

import type { CategoryKey } from '../../types/fantasy';
import { toiSeconds, type GameLine } from '../nhl/gamecenter';
import { categoryDef } from './categories';
import { isShutout, powerPlayPointsOf, type PlayerNight } from './nightScore';

export interface CategoryTally {
  key: CategoryKey;
  short: string;
  /** "3", "+2", "2.50", ".917" — or "—" while a goalie rate has nothing to measure. */
  text: string;
}

export interface NightTotals {
  goals: number;
  assists: number;
  plusMinus: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  wins: number;
  shutouts: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  goalieSeconds: number;
}

const SECONDS_PER_GAME = 60 * 60;

/** Box-score totals over these players. A goalie's win and shutout count once his game is final. */
export function nightTotals(rows: PlayerNight[], lines: Map<number, GameLine>): NightTotals {
  const totals: NightTotals = {
    goals: 0,
    assists: 0,
    plusMinus: 0,
    ppp: 0,
    shots: 0,
    hits: 0,
    blocks: 0,
    wins: 0,
    shutouts: 0,
    saves: 0,
    shotsAgainst: 0,
    goalsAgainst: 0,
    goalieSeconds: 0,
  };
  for (const row of rows) {
    const line = lines.get(row.playerId);
    if (!line) continue;
    if (line.isGoalie) {
      totals.saves += line.saves;
      totals.shotsAgainst += line.shotsAgainst;
      totals.goalsAgainst += line.goalsAgainst;
      totals.goalieSeconds += toiSeconds(line.toi);
      if (row.won) totals.wins += 1;
      if (isShutout(line, !!row.won)) totals.shutouts += 1;
      continue;
    }
    totals.goals += line.goals;
    totals.assists += line.assists;
    totals.plusMinus += line.plusMinus;
    totals.ppp += powerPlayPointsOf(line);
    totals.shots += line.shots;
    totals.hits += line.hits;
    totals.blocks += line.blocks;
  }
  return totals;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** ".917" the way box scores print it; a perfect night is "1.000". */
export function savePctText(saves: number, shotsAgainst: number): string {
  if (shotsAgainst <= 0) return '—';
  const pct = (saves / shotsAgainst).toFixed(3);
  return pct.startsWith('0') ? pct.slice(1) : pct;
}

export function gaaText(goalsAgainst: number, seconds: number): string {
  return seconds > 0 ? ((goalsAgainst * SECONDS_PER_GAME) / seconds).toFixed(2) : '—';
}

function tallyText(key: CategoryKey, totals: NightTotals): string {
  switch (key) {
    case 'points':
      return String(totals.goals + totals.assists);
    case 'plusMinus':
      return signed(totals.plusMinus);
    case 'gaa':
      return gaaText(totals.goalsAgainst, totals.goalieSeconds);
    case 'savePct':
      return savePctText(totals.saves, totals.shotsAgainst);
    default:
      return String(totals[key]);
  }
}

/** One tally per counted category, in the league's order. */
export function nightTallies(rows: PlayerNight[], lines: Map<number, GameLine>, categories: CategoryKey[]): CategoryTally[] {
  const totals = nightTotals(rows, lines);
  return categories.map((key) => ({ key, short: categoryDef(key).short, text: tallyText(key, totals) }));
}

/** Skater counting categories in the order a one-glance headline prefers them. */
const HEADLINE_CATEGORIES: CategoryKey[] = ['goals', 'assists', 'points', 'ppp', 'shots', 'hits', 'blocks'];
/** A Dynamic Island fits about two tallies. */
const HEADLINE_TALLIES = 2;

/** The night at a glance for a widget or the Dynamic Island: "3G 5A" (or "21 SOG 14 HIT"). Null with no skater categories. */
export function talliesHeadline(tallies: CategoryTally[]): string | null {
  const picks = HEADLINE_CATEGORIES
    .map((key) => tallies.find((tally) => tally.key === key))
    .filter((tally): tally is CategoryTally => !!tally)
    .slice(0, HEADLINE_TALLIES);
  if (picks.length === 0) return null;
  return picks.map((tally) => `${tally.text}${tally.short.length === 1 ? '' : ' '}${tally.short}`).join(' ');
}

/** "3 G · 5 A · +4 +/- · 21 SOG" — compact, for a caption, a widget or a share card. */
export function talliesLine(tallies: CategoryTally[], limit = tallies.length): string {
  return tallies
    .slice(0, limit)
    .map((tally) => `${tally.text} ${tally.short}`)
    .join(' · ');
}

/** One player's night in his league's categories: "1G · 2A · +2 +/- · 4 SOG · 3 HIT", or "31 SV · 2 GA · .939". */
export function categoryLineText(line: GameLine, categories: CategoryKey[]): string {
  if (line.isGoalie) return `${line.saves} SV · ${line.goalsAgainst} GA · ${savePctText(line.saves, line.shotsAgainst)}`;
  const counted = new Set(categories);
  const parts: string[] = [];
  const add = (key: CategoryKey, value: number, text: string) => {
    if (counted.has(key) && value !== 0) parts.push(text);
  };
  add('goals', line.goals, `${line.goals}G`);
  add('assists', line.assists, `${line.assists}A`);
  if (!counted.has('goals') && !counted.has('assists')) add('points', line.goals + line.assists, `${line.goals + line.assists}P`);
  add('plusMinus', line.plusMinus, `${signed(line.plusMinus)} +/-`);
  add('ppp', powerPlayPointsOf(line), `${powerPlayPointsOf(line)} PPP`);
  // Shots are always worth showing in a league that counts them — like a broadcast line.
  if (counted.has('shots')) parts.push(`${line.shots} SOG`);
  add('hits', line.hits, `${line.hits} HIT`);
  add('blocks', line.blocks, `${line.blocks} BLK`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing in your categories yet';
}

/** The shortest version, for a tile under a name: "1G 2A", "4 SOG", "31 SV". */
export function tileLineText(line: GameLine): string {
  if (line.isGoalie) return `${line.saves} SV`;
  const scoring = [line.goals ? `${line.goals}G` : '', line.assists ? `${line.assists}A` : ''].filter(Boolean);
  return scoring.length > 0 ? scoring.join(' ') : `${line.shots} SOG`;
}
