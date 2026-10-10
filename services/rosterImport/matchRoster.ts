/**
 * Turns roster text into NHL players. The rows come from text pasted out of Yahoo, ESPN or
 * Fantrax, or from screenshots read on the phone. Pure.
 *
 * In each row, in order:
 *   1. full names ("Connor McDavid");
 *   2. initial plus last name ("C. McDavid");
 *   3. a name cut short in the app ("Connor McDav…");
 *   4. a one-letter reading slip in the last name ("Connor McDavld");
 *   5. a last name on its own, only in short rows.
 * A team code in the row or the next one ("Edm - C") settles players who share a name. Anything
 * still unclear comes back as a choice, never a guess.
 */

import type { RosterPlayer } from '../nhl/rosters';
import { nameTokens, normalizeName, teamsInRow } from './normalize';

export type MatchConfidence = 'exact' | 'likely';

export interface MatchedPlayer {
  player: RosterPlayer;
  confidence: MatchConfidence;
  /** The text it was read from. */
  source: string;
}

export interface AmbiguousName {
  source: string;
  options: RosterPlayer[];
}

export interface RosterMatch {
  matched: MatchedPlayer[];
  ambiguous: AmbiguousName[];
  /** Names inside the roster list that matched nobody (shown so users know what's missing). */
  unmatched: string[];
  /** Every name-shaped row that matched nobody, in order: what a per-name search can still try. */
  leftovers: string[];
}

export interface PlayerIndex {
  byFull: Map<string, RosterPlayer[]>;
  byLast: Map<string, RosterPlayer[]>;
  byFirst: Map<string, RosterPlayer[]>;
  maxFullWords: number;
  maxLastWords: number;
}

/** A row this short can be a bare last name ("McDavid", "McDavid EDM C"); longer rows can't. */
const MAX_LAST_NAME_ONLY_TOKENS = 4;
/** Shorter fragments ("Mc…") match too many players to mean anything. */
const MIN_TRUNCATED_LAST = 3;
/** Short names are too easy to hit by accident with a one-letter slip ("Hall" / "Hill"). */
const MIN_SLIP_LAST = 5;

const NAME_SHAPE = /^[A-ZÀ-Þ][\p{L}'’.-]+(?:\s+[A-ZÀ-Þ][\p{L}'’.-]+){1,2}$/u;
const NOT_NAMES = new Set([
  'my team', 'free agents', 'set lineup', 'start active', 'start active players', 'injured reserve', 'daily lineup',
  'weekly lineup', 'team stats', 'player notes', 'add drop', 'trade', 'roster', 'matchup', 'league', 'players',
  'bench', 'starters', 'goalies', 'skaters', 'total', 'today', 'tomorrow', 'yahoo fantasy', 'espn fantasy',
]);

export function buildPlayerIndex(players: RosterPlayer[]): PlayerIndex {
  const byFull = new Map<string, RosterPlayer[]>();
  const byLast = new Map<string, RosterPlayer[]>();
  const byFirst = new Map<string, RosterPlayer[]>();
  let maxFullWords = 2;
  let maxLastWords = 1;
  const add = (map: Map<string, RosterPlayer[]>, key: string, player: RosterPlayer) => {
    if (!key) return;
    const list = map.get(key);
    if (!list) map.set(key, [player]);
    else if (!list.some((each) => each.playerId === player.playerId)) list.push(player);
  };
  for (const player of players) {
    const first = normalizeName(player.firstName);
    const last = normalizeName(player.lastName);
    const full = `${first} ${last}`.trim();
    add(byFull, full, player);
    add(byLast, last, player);
    add(byFirst, first, player);
    maxFullWords = Math.max(maxFullWords, full.split(' ').length);
    maxLastWords = Math.max(maxLastWords, last.split(' ').length);
  }
  return { byFull, byLast, byFirst, maxFullWords, maxLastWords };
}

/** "C" or "CM" (Connor McDavid), "JT" (J.T. Miller), "PL" (Pierre-Luc). */
function initialsFit(firstName: string, token: string): boolean {
  const first = normalizeName(firstName);
  if (!first || !token) return false;
  const words = first.split(' ');
  return token === first[0] || token === words.map((word) => word[0]).join('') || token === words.join('');
}

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface Hit {
  players: RosterPlayer[];
  confidence: MatchConfidence;
  source: string;
}

function findInRow(row: string, index: PlayerIndex): Hit[] {
  const tokens = nameTokens(row);
  const truncated = /…|\.\.\./.test(row);
  const hits: Hit[] = [];
  let i = 0;
  while (i < tokens.length) {
    let taken = 0;
    // 1. Full names, longest first.
    for (let len = Math.min(index.maxFullWords, tokens.length - i); len >= 2 && !taken; len -= 1) {
      const key = tokens.slice(i, i + len).join(' ');
      const players = index.byFull.get(key);
      if (players) {
        hits.push({ players, confidence: 'exact', source: key });
        taken = len;
      }
    }
    // 2. Initial(s) then last name: "c mcdavid", "jt miller".
    if (!taken && tokens[i].length <= 2) {
      for (let len = Math.min(index.maxLastWords, tokens.length - i - 1); len >= 1 && !taken; len -= 1) {
        const last = tokens.slice(i + 1, i + 1 + len).join(' ');
        const players = index.byLast.get(last)?.filter((player) => initialsFit(player.firstName, tokens[i]));
        if (players && players.length > 0) {
          hits.push({ players, confidence: 'likely', source: `${tokens[i]} ${last}` });
          taken = len + 1;
        }
      }
    }
    // 3 + 4. First name, then a last name cut short ("mcdav…") or one letter off ("mcdavld").
    if (!taken && i + 1 < tokens.length) {
      const sameFirst = index.byFirst.get(tokens[i]);
      const lastPart = tokens[i + 1];
      if (sameFirst) {
        const cut = truncated && lastPart.length >= MIN_TRUNCATED_LAST
          ? sameFirst.filter((player) => normalizeName(player.lastName).startsWith(lastPart))
          : [];
        const slip = cut.length === 0 && lastPart.length >= MIN_SLIP_LAST
          ? sameFirst.filter((player) => withinOneEdit(normalizeName(player.lastName), lastPart))
          : [];
        const players = cut.length > 0 ? cut : slip;
        if (players.length > 0) {
          hits.push({ players, confidence: 'likely', source: `${tokens[i]} ${lastPart}` });
          taken = 2;
        }
      }
    }
    i += taken || 1;
  }
  // 5. A last name on its own, only in short rows that found nothing else.
  if (hits.length === 0 && tokens.length > 0 && tokens.length <= MAX_LAST_NAME_ONLY_TOKENS) {
    for (let start = 0; start < tokens.length && hits.length === 0; start += 1) {
      for (let len = Math.min(index.maxLastWords, tokens.length - start); len >= 1; len -= 1) {
        const last = tokens.slice(start, start + len).join(' ');
        if (last.length < MIN_TRUNCATED_LAST) continue;
        const players = index.byLast.get(last);
        if (players) {
          hits.push({ players, confidence: 'likely', source: last });
          break;
        }
      }
    }
  }
  return hits;
}

/** Narrows same-name players with a team code from the row (or, failing that, the next row). */
function settle(hit: Hit, teams: Set<string>[]): { player: RosterPlayer } | { options: RosterPlayer[] } {
  if (hit.players.length === 1) return { player: hit.players[0] };
  for (const rowTeams of teams) {
    if (rowTeams.size === 0) continue;
    const narrowed = hit.players.filter((player) => rowTeams.has(player.team));
    if (narrowed.length === 1) return { player: narrowed[0] };
    if (narrowed.length > 1) return { options: narrowed };
  }
  return { options: hit.players };
}

/** A real name has a word of four letters or more ("Ott- LW" and "NJ-C" are team lines). */
const MIN_LONGEST_NAME_WORD = 4;

/**
 * The person's name in a row, without slot labels and codes: "RW  Nikita Kucherov" -> "Nikita
 * Kucherov", "IR+ Alexis Lafrenière" -> "Alexis Lafrenière". Empty when there's no name shape.
 */
export function nameFromRow(row: string): string {
  const words = row.trim().split(/\s+/).filter((word) => /\p{Ll}/u.test(word) && !/[\d@]/.test(word));
  const name = words.slice(0, 3).join(' ');
  if (!NAME_SHAPE.test(name) || NOT_NAMES.has(normalizeName(name))) return '';
  return words.some((word) => word.replace(/[^\p{L}]/gu, '').length >= MIN_LONGEST_NAME_WORD) ? name : '';
}

export function matchRosterRows(rows: string[], index: PlayerIndex): RosterMatch {
  const teamsByRow = rows.map(teamsInRow);
  const matched = new Map<number, MatchedPlayer>();
  const ambiguous: AmbiguousName[] = [];
  const nameRows: { row: number; name: string }[] = [];
  let firstHit = -1;
  let lastHit = -1;

  rows.forEach((row, rowIndex) => {
    const hits = findInRow(row, index);
    if (hits.length === 0) {
      const name = nameFromRow(row);
      if (name) nameRows.push({ row: rowIndex, name });
      return;
    }
    if (firstHit < 0) firstHit = rowIndex;
    lastHit = rowIndex;
    const teams = [teamsByRow[rowIndex], teamsByRow[rowIndex + 1] ?? new Set<string>()];
    for (const hit of hits) {
      const settled = settle(hit, teams);
      if ('player' in settled) {
        const existing = matched.get(settled.player.playerId);
        if (!existing || (existing.confidence === 'likely' && hit.confidence === 'exact')) {
          matched.set(settled.player.playerId, { player: settled.player, confidence: hit.confidence, source: row.trim() });
        }
      } else if (!settled.options.some((option) => matched.has(option.playerId))) {
        ambiguous.push({ source: row.trim(), options: settled.options });
      }
    }
  });

  // A name first seen as ambiguous and later matched outright doesn't need asking about.
  const stillAmbiguous = ambiguous.filter((entry) => !entry.options.some((option) => matched.has(option.playerId)));
  // Only names inside the roster list count as missed (not the team or league name above it).
  const unmatched = nameRows.filter(({ row }) => firstHit < 0 || (row > firstHit && row < lastHit)).map(({ name }) => name);
  const leftovers = nameRows.map(({ name }) => name);
  return { matched: [...matched.values()], ambiguous: dedupeAmbiguous(stillAmbiguous), unmatched: [...new Set(unmatched)], leftovers: [...new Set(leftovers)] };
}

/**
 * Fills missed names from a per-name player search — players on a team whose roster didn't load,
 * or a call-up who isn't on one yet. `found` maps a leftover name to the player it exactly is.
 */
export function mergeSearchMatches(match: RosterMatch, found: ReadonlyMap<string, RosterPlayer>): RosterMatch {
  if (found.size === 0) return match;
  const matched = [...match.matched];
  const have = new Set(matched.map((entry) => entry.player.playerId));
  for (const name of match.leftovers) {
    const player = found.get(name);
    if (player && !have.has(player.playerId)) {
      matched.push({ player, confidence: 'likely', source: name });
      have.add(player.playerId);
    }
  }
  const missing = (name: string) => !found.has(name);
  return { ...match, matched, unmatched: match.unmatched.filter(missing), leftovers: match.leftovers.filter(missing) };
}

function dedupeAmbiguous(entries: AmbiguousName[]): AmbiguousName[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.options.map((option) => option.playerId).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pasted text: one row per line. A line that is a list of names ("McDavid, Draisaitl, Hyman" or
 * "Connor McDavid; Leon Draisaitl") splits into one row per name; "McDavid, Connor" stays whole.
 */
export function rowsFromPastedText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      if (/\d/.test(line)) return [line];
      const pieces = line.split(/[,;]/).map((piece) => piece.trim()).filter(Boolean);
      const isList = pieces.length >= 3 || (pieces.length === 2 && pieces.every((piece) => piece.includes(' ')));
      return isList ? pieces : [line];
    })
    .map((line) => line.trim())
    .filter(Boolean);
}
