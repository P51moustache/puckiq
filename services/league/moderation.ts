/**
 * Room and team names — the only free text a League Room carries (no chat, App Review 1.2).
 * Tidies what people type and blocks slurs and the most common profanity, with the simple
 * normalisation that catches the usual dodges: case, accents, leetspeak, stretched letters
 * ("fuuuck") and spelled-out letters ("f.u.c.k"). It's a filter, not a moderator: members can
 * leave, owners can remove, and Settings has "Report a room".
 */

import { ROOM_NAME_MAX } from '../../types/league';

export type RoomTextProblem = 'empty' | 'too_long' | 'blocked';
export type RoomTextResult = { ok: true; value: string } | { ok: false; reason: RoomTextProblem };

/** The name a team goes by in a room when its device name can't be used (blank or blocked). */
export const FALLBACK_TEAM_NAME = 'My Team';

type Range = readonly [number, number];

/** Invisible characters people paste or use to spoof: controls, zero-width spaces, bidi overrides. */
const INVISIBLE: readonly Range[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad], // soft hyphen
  [0x061c, 0x061c], // Arabic letter mark
  [0x180e, 0x180e], // Mongolian vowel separator
  [0x200b, 0x200b], // zero-width space (ZWNJ / ZWJ stay: scripts and emoji sequences need them)
  [0x200e, 0x200f], // left-to-right / right-to-left marks
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x2064], // word joiner, invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // byte-order mark
  [0xfff9, 0xfffb], // interlinear annotation marks
];

/** Code points with no letter or digit in them: punctuation, symbols, emoji and their joiners. */
const DECORATIVE: readonly Range[] = [
  [0x0000, 0x002f], // controls, space, ASCII punctuation
  [0x003a, 0x0040], // : ; < = > ? @
  [0x005b, 0x0060], // [ \ ] ^ _ `
  [0x007b, 0x00bf], // { | } ~, C1 controls, Latin-1 punctuation and symbols (© ®)
  [0x00d7, 0x00d7], // ×
  [0x00f7, 0x00f7], // ÷
  [0x0300, 0x036f], // combining accents on their own
  [0x2000, 0x2bff], // general punctuation, ZWJ, keycap, arrows, maths, dingbats, misc symbols
  [0x3000, 0x303f], // CJK symbols and punctuation
  [0xe000, 0xf8ff], // private use
  [0xfe00, 0xfe0f], // variation selectors (emoji presentation)
  [0xfff0, 0xffff], // specials
  [0x1f000, 0x1fbff], // emoji, flags, cards, pictographs
  [0xe0000, 0xe01ef], // tag characters (subdivision flags), variation selectors supplement
];

/**
 * Blocked anywhere inside a word ("fuckers", "xxniggerxx"): slurs and the strongest profanity
 * that don't hide inside ordinary words or hockey names.
 */
const BLOCKED_ANYWHERE = ['fuck', 'cunt', 'shit', 'bitch', 'whore', 'asshole', 'nigger', 'nigga', 'faggot', 'wetback'];

/**
 * Blocked only as a whole word (plus plural / -ed): each hides inside innocent words — ass in
 * "assist" and "bass", spic in "spice", coon in "raccoon", cock in "Hancock", dick in "Dickens".
 */
const BLOCKED_WORDS = ['ass', 'fag', 'spic', 'kike', 'chink', 'coon', 'tranny', 'retard', 'dick', 'cock', 'pussy', 'slut', 'twat'];

/** Leetspeak and symbol stand-ins, read as the letter they replace. */
const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

/** Each letter may repeat ("fuuuck") but every letter is still needed ("niger" is not "nigger"). */
function stretchable(word: string): string {
  return Array.from(word)
    .map((char) => `${char}+`)
    .join('');
}

const ANYWHERE_PATTERNS = BLOCKED_ANYWHERE.map((word) => new RegExp(stretchable(word)));
const WORD_PATTERNS = BLOCKED_WORDS.map((word) => new RegExp(`^${stretchable(word)}(?:s|es|z|ed)?$`));

function inRanges(char: string, ranges: readonly Range[]): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/** Whitespace runs become one space, invisible characters go, the ends are trimmed. */
function tidy(input: string): string {
  const spaced = input.replace(/\s+/g, ' ');
  const visible = Array.from(spaced)
    .filter((char) => !inRanges(char, INVISIBLE))
    .join('');
  return visible.replace(/ {2,}/g, ' ').trim();
}

function hasLetterOrDigit(text: string): boolean {
  return Array.from(text).some((char) => !inRanges(char, DECORATIVE));
}

function stripAccents(text: string): string {
  try {
    return text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  } catch {
    return text;
  }
}

/** "f u c k" and "f.u.c.k" read as one word: runs of single letters are joined. */
function spelledOut(words: string[]): string[] {
  const joined: string[] = [];
  let run = '';
  for (const word of [...words, '']) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run.length > 1) joined.push(run);
    run = '';
  }
  return joined;
}

function wordsToCheck(text: string): string[] {
  const folded = Array.from(stripAccents(text.toLowerCase()))
    .map((char) => LEET[char] ?? char)
    .join('');
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  return [...words, ...spelledOut(words)];
}

function isBlocked(text: string): boolean {
  return wordsToCheck(text).some(
    (word) => ANYWHERE_PATTERNS.some((pattern) => pattern.test(word)) || WORD_PATTERNS.some((pattern) => pattern.test(word)),
  );
}

/**
 * A room or team name, cleaned: whitespace collapsed, invisible characters removed. Rejected when
 * nothing readable is left (blank, or only emoji / punctuation), when it's longer than `max`
 * characters (counted like Postgres `char_length`, so an emoji is one), or when it contains a
 * blocked word.
 */
export function cleanRoomText(input: string | null | undefined, max: number = ROOM_NAME_MAX): RoomTextResult {
  const value = tidy(typeof input === 'string' ? input : '');
  if (!hasLetterOrDigit(value)) return { ok: false, reason: 'empty' };
  if (Array.from(value).length > max) return { ok: false, reason: 'too_long' };
  if (isBlocked(value)) return { ok: false, reason: 'blocked' };
  return { ok: true, value };
}

/**
 * The name this device's team goes by in a room. Team names are typed freely on the device, so a
 * long one is clipped to fit and a blank or blocked one becomes FALLBACK_TEAM_NAME — a roster
 * sync should never fail because of a name.
 */
export function roomTeamName(name: string): string {
  const clipped = Array.from(tidy(name)).slice(0, ROOM_NAME_MAX).join('');
  const result = cleanRoomText(clipped);
  return result.ok ? result.value : FALLBACK_TEAM_NAME;
}

/** User-facing copy for a rejected name. */
export function roomTextMessage(reason: RoomTextProblem, max: number = ROOM_NAME_MAX): string {
  switch (reason) {
    case 'empty':
      return 'Add a name with at least one letter or number.';
    case 'too_long':
      return `Keep it to ${max} characters or fewer.`;
    case 'blocked':
      return 'Pick a different name — that one isn’t allowed in League Rooms.';
  }
}
