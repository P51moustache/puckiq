/**
 * League dues — tracking only. PuckIQ never holds or moves money; the owner records who paid and
 * where the pot lives (e.g. a LeagueSafe link). Pure: validation for the editor, a summary for
 * the room.
 */

import type { Room, RoomCurrency, RoomDues, RoomDuesStatus, RoomMember, RoomPayout } from '../../types/league';
import { daysBetween } from '../nhl/dates';
import { byTeamName } from './members';

/**
 * Per-member ceiling. A sanity check, not a policy: it stops a typo (an extra zero or two) from
 * becoming the pot. Whole currency units, like every dues amount.
 */
export const MAX_DUES_AMOUNT = 10_000;

/** Pot-host links (LeagueSafe, PayPal pools) are far shorter; anything longer is pasted junk. */
const MAX_POT_LINK_LENGTH = 300;

const CURRENCIES: readonly RoomCurrency[] = ['USD', 'CAD'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** https, a dotted host, then an optional path / query / fragment — no spaces anywhere. */
const HTTPS_LINK = /^https:\/\/[^\s/?#@]+\.[^\s/?#@]+(?:[/?#]\S*)?$/i;

export type DuesProblem =
  | 'amount'
  | 'currency'
  | 'deadline'
  | 'payout_places'
  | 'payout_amount'
  | 'payouts_exceed_pot'
  | 'pot_link';

export type DuesValidation = { ok: true; dues: RoomDues } | { ok: false; reason: DuesProblem };

export interface DuesSummary {
  /** Per member; null = this room has no dues. */
  amount: number | null;
  currency: RoomCurrency;
  deadline: string | null;
  /** amount × league size — every team in the league pays, joined to the room or not. */
  potTotal: number;
  /** amount × members marked paid. */
  collected: number;
  paidCount: number;
  memberCount: number;
  /** Members not marked paid, by team name. Empty when there's nothing to pay. */
  unpaid: RoomMember[];
  payoutsTotal: number;
  /** Places run 1..n without repeats, amounts are whole and positive, and the total fits the pot. */
  payoutsValid: boolean;
  /** Whether `today` (YYYY-MM-DD) is after the deadline; the deadline day itself is still on time. */
  deadlinePassed(today: string): boolean;
}

/** "10,000" — whole amounts with thousands separators, independent of the device's Intl support. */
export function formatAmount(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Pot links must be https — no http, no app schemes, no javascript:. */
export function isHttpsLink(text: string): boolean {
  return text.length <= MAX_POT_LINK_LENGTH && HTTPS_LINK.test(text);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function payoutProblem(payouts: RoomPayout[], pot: number | null, leagueSize?: number): DuesProblem | null {
  if (payouts.some((payout) => !Number.isInteger(payout.amount) || payout.amount <= 0)) return 'payout_amount';
  const places = payouts.map((payout) => payout.place);
  const count = payouts.length;
  const runsOneToN = new Set(places).size === count && places.every((place) => Number.isInteger(place) && place >= 1 && place <= count);
  if (!runsOneToN || (leagueSize !== undefined && count > leagueSize)) return 'payout_places';
  if (pot !== null && sum(payouts.map((payout) => payout.amount)) > pot) return 'payouts_exceed_pot';
  return null;
}

/**
 * Checks dues from the editor and returns them normalised (payouts sorted by place, a blank pot
 * link as null). Pass the room's league size to also check the payouts fit the pot
 * (amount × league size) and don't pay more places than there are teams — the editor should;
 * without it every other rule still runs and the server enforces the rest.
 */
export function validateDues(input: RoomDues, leagueSize?: number): DuesValidation {
  const { amount } = input;
  if (amount !== null && !(Number.isInteger(amount) && amount >= 0 && amount <= MAX_DUES_AMOUNT)) {
    return { ok: false, reason: 'amount' };
  }
  if (!CURRENCIES.includes(input.currency)) return { ok: false, reason: 'currency' };
  if (input.deadline !== null && !isIsoDate(input.deadline)) return { ok: false, reason: 'deadline' };
  const potLink = input.potLink?.trim() || null;
  if (potLink !== null && !isHttpsLink(potLink)) return { ok: false, reason: 'pot_link' };

  const payouts = [...input.payouts]
    .sort((a, b) => a.place - b.place)
    .map((payout) => ({ place: payout.place, amount: payout.amount }));
  const pot = leagueSize === undefined ? null : (amount ?? 0) * leagueSize;
  const problem = payoutProblem(payouts, pot, leagueSize);
  if (problem) return { ok: false, reason: problem };

  return { ok: true, dues: { amount, currency: input.currency, deadline: input.deadline, payouts, potLink } };
}

/** User-facing copy for a dues problem. */
export function duesProblemMessage(reason: DuesProblem): string {
  switch (reason) {
    case 'amount':
      return `Dues are a whole amount from 0 to ${formatAmount(MAX_DUES_AMOUNT)}.`;
    case 'currency':
      return 'Pick USD or CAD.';
    case 'deadline':
      return 'Pick a real date for the deadline.';
    case 'payout_places':
      return 'Payout places run 1st, 2nd, 3rd… with no gaps or repeats, and no more places than teams.';
    case 'payout_amount':
      return 'Each payout is a whole amount above zero.';
    case 'payouts_exceed_pot':
      return 'The payouts add up to more than the pot.';
    case 'pot_link':
      return 'Pot links must start with https://.';
  }
}

/** The room's dues at a glance: pot, who's paid, who hasn't, and whether the payouts add up. */
export function summarizeDues(room: Room, statuses: RoomDuesStatus[], members: RoomMember[]): DuesSummary {
  const { amount, currency, deadline, payouts } = room.dues;
  const perMember = amount ?? 0;
  const paidIds = new Set(statuses.filter((status) => status.paid).map((status) => status.userId));
  const paidCount = members.filter((member) => paidIds.has(member.userId)).length;
  const potTotal = perMember * room.leagueSize;
  return {
    amount,
    currency,
    deadline,
    potTotal,
    collected: perMember * paidCount,
    paidCount,
    memberCount: members.length,
    unpaid: perMember > 0 ? members.filter((member) => !paidIds.has(member.userId)).sort(byTeamName) : [],
    payoutsTotal: sum(payouts.map((payout) => payout.amount)),
    payoutsValid: payoutProblem(payouts, potTotal, room.leagueSize) === null,
    deadlinePassed: (today: string) => deadline !== null && daysBetween(deadline, today) > 0,
  };
}
