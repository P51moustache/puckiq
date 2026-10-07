/**
 * Invite codes and links. A room code is ROOM_CODE_LENGTH characters from ROOM_CODE_ALPHABET
 * (no look-alikes). Invites travel as a web link (a page with "Open in PuckIQ" + App Store) or a
 * `puckiq://` deep link; the in-app "Join with code" field accepts either, or the bare code.
 */

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../types/league';

/** The public join page (GitHub Pages). */
export const INVITE_PAGE_URL = 'https://p51moustache.github.io/puckiq/join.html';
/** Deep link prefix handled by the Expo Router route `app/join/[code].tsx`. */
export const INVITE_DEEP_LINK_BASE = 'puckiq://join/';

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
/** The join page, with or without `.html` / a trailing slash, then its query string. */
const WEB_LINK = /^https?:\/\/p51moustache\.github\.io\/puckiq\/join(?:\.html)?\/?\?([^#]*)/i;
/** `puckiq://join/CODE`; some launchers hand the app a third slash. */
const DEEP_LINK = /^puckiq:\/\/\/?join\/([^/?#]*)/i;
/** Separators people type or paste inside a bare code: "ABC 234", "abc-234". */
const CODE_SEPARATORS = /[\s-]/g;
/** Room name used in an invite when the room's own name is blank. */
const UNNAMED_ROOM = 'our league room';

/** Upper-cases and drops every character outside ROOM_CODE_ALPHABET. Does not check the length. */
export function normalizeRoomCode(input: string): string {
  return Array.from(input.toUpperCase())
    .filter((char) => ROOM_CODE_ALPHABET.includes(char))
    .join('');
}

/** Whether `code` is a canonical room code: exactly ROOM_CODE_LENGTH upper-case alphabet characters. */
export function isValidRoomCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function inviteUrl(code: string): string {
  return `${INVITE_PAGE_URL}?code=${normalizeRoomCode(code)}`;
}

export function inviteDeepLink(code: string): string {
  return `${INVITE_DEEP_LINK_BASE}${normalizeRoomCode(code)}`;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function queryValue(query: string, key: string): string | null {
  for (const pair of query.split('&')) {
    const [name, ...rest] = pair.split('=');
    if (safeDecode(name)?.toLowerCase() === key) return safeDecode(rest.join('='));
  }
  return null;
}

function canonical(code: string | null): string | null {
  if (code === null) return null;
  const upper = code.trim().toUpperCase();
  return isValidRoomCode(upper) ? upper : null;
}

/**
 * The room code inside an invite web link, a `puckiq://join/CODE` deep link, or a bare code
 * ("abc234", "ABC 234"). Null for anything else — other sites, other app routes, codes with
 * characters outside the alphabet, or the wrong length.
 */
export function codeFromLink(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;
  const web = WEB_LINK.exec(text);
  if (web) return canonical(queryValue(web[1], 'code'));
  const deep = DEEP_LINK.exec(text);
  if (deep) return canonical(safeDecode(deep[1]));
  if (text.includes(':') || text.includes('/')) return null;
  return canonical(text.replace(CODE_SEPARATORS, ''));
}

/** Share-sheet text: one line of invite, the web link, and the code for typing in by hand. */
export function inviteMessage(roomName: string, code: string): string {
  const name = roomName.replace(/\s+/g, ' ').trim();
  const room = name ? `“${name}”` : UNNAMED_ROOM;
  const canonicalCode = normalizeRoomCode(code);
  return [`Join ${room} on PuckIQ.`, inviteUrl(canonicalCode), `Room code: ${canonicalCode}`].join('\n');
}
