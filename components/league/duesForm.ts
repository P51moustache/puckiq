/**
 * The dues editor's text fields ⇄ RoomDues. Parsing is forgiving ("$1,200" is 1200); judging is
 * `validateDues`' job, so an unreadable number passes through as NaN and comes back as a problem
 * with the services' own copy.
 */

import type { RoomCurrency, RoomDues } from '../../types/league';
import { duesProblemMessage, validateDues } from '../../services/league';

export interface DuesForm {
  amount: string;
  currency: RoomCurrency;
  /** YYYY-MM-DD, or blank for no deadline. */
  deadline: string;
  /** Payout amounts by place: index 0 is 1st. */
  payouts: string[];
  potLink: string;
}

export type DuesCheck = { ok: true; dues: RoomDues } | { ok: false; message: string };

export function duesToForm(dues: RoomDues): DuesForm {
  return {
    amount: dues.amount === null ? '' : String(dues.amount),
    currency: dues.currency,
    deadline: dues.deadline ?? '',
    payouts: [...dues.payouts].sort((a, b) => a.place - b.place).map((payout) => String(payout.amount)),
    potLink: dues.potLink ?? '',
  };
}

/** "$1,200" → 1200; blank → null; anything else that isn't a plain number → NaN. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s$,]/g, '');
  if (!cleaned) return null;
  return /^\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/** Blank payout rows at the end are unfinished rows, not payouts. A blank in the middle is a problem. */
function filledPayouts(payouts: string[]): string[] {
  let end = payouts.length;
  while (end > 0 && payouts[end - 1].trim() === '') end -= 1;
  return payouts.slice(0, end);
}

export function formToDues(form: DuesForm): RoomDues {
  return {
    amount: parseAmount(form.amount),
    currency: form.currency,
    deadline: form.deadline.trim() || null,
    payouts: filledPayouts(form.payouts).map((text, index) => ({ place: index + 1, amount: parseAmount(text) ?? Number.NaN })),
    potLink: form.potLink.trim() || null,
  };
}

/** The editor's verdict: dues ready to save, or what to fix. Payouts must fit amount × league size. */
export function checkDuesForm(form: DuesForm, leagueSize: number): DuesCheck {
  const result = validateDues(formToDues(form), leagueSize);
  return result.ok ? { ok: true, dues: result.dues } : { ok: false, message: duesProblemMessage(result.reason) };
}
