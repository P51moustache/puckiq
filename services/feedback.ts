/**
 * In-app feedback (Settings > Send feedback). Rows land in Supabase `app_feedback`,
 * which clients can insert into but never read. If Supabase is unreachable, the sheet
 * falls back to a prefilled email so nothing a user writes is lost.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SUPPORT_EMAIL } from '../constants/legal';

export type FeedbackCategory = 'bug' | 'idea' | 'praise' | 'other';

export const FEEDBACK_CATEGORIES: { id: FeedbackCategory; label: string; prompt: string }[] = [
  { id: 'bug', label: 'Bug', prompt: 'What happened, and what did you expect?' },
  { id: 'idea', label: 'Idea', prompt: 'What would make PuckIQ better for your league?' },
  { id: 'praise', label: 'Love it', prompt: 'What’s working for you?' },
  { id: 'other', label: 'Other', prompt: 'What’s on your mind?' },
];

export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 4000;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  email?: string;
}

/** What the app attaches so a report is actionable. No roster, no names. */
export interface FeedbackContext {
  appVersion?: string;
  build?: string;
  platform?: string;
  osVersion?: string;
  device?: string;
  isPro?: boolean;
  screen?: string;
  userId?: string | null;
}

export interface FeedbackRow {
  category: FeedbackCategory;
  message: string;
  email: string | null;
  app_version: string | null;
  build: string | null;
  platform: string | null;
  os_version: string | null;
  device: string | null;
  is_pro: boolean | null;
  screen: string | null;
  user_id: string | null;
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

/** Why the form can't be sent yet, or null when it can. */
export function feedbackProblem(input: FeedbackInput): string | null {
  const message = input.message.trim();
  if (message.length < FEEDBACK_MIN) return 'Add a few words first.';
  if (message.length > FEEDBACK_MAX) return `Keep it under ${FEEDBACK_MAX} characters.`;
  const email = input.email?.trim();
  if (email && !isValidEmail(email)) return 'That email doesn’t look right.';
  return null;
}

const clip = (value: string | undefined, max: number) => (value ? value.slice(0, max) : null);

export function buildFeedbackRow(input: FeedbackInput, context: FeedbackContext): FeedbackRow {
  const email = input.email?.trim();
  return {
    category: input.category,
    message: input.message.trim().slice(0, FEEDBACK_MAX),
    email: email && isValidEmail(email) ? email : null,
    app_version: clip(context.appVersion, 32),
    build: clip(context.build, 16),
    platform: clip(context.platform, 16),
    os_version: clip(context.osVersion, 32),
    device: clip(context.device, 64),
    is_pro: context.isPro ?? null,
    screen: clip(context.screen, 64),
    user_id: context.userId ?? null,
  };
}

/** Insert only (no read-back): the table has no select policy, by design. */
export async function sendFeedback(row: FeedbackRow, client = supabase, configured = isSupabaseConfigured): Promise<void> {
  if (!configured) throw new Error('Feedback backend not configured');
  const { error } = await client.from('app_feedback').insert(row);
  if (error) throw new Error(error.message);
}

/** Prefilled email carrying the same message and context, for when the insert fails. */
export function feedbackMailto(row: FeedbackRow, to = SUPPORT_EMAIL): string {
  const label = FEEDBACK_CATEGORIES.find((c) => c.id === row.category)?.label ?? 'Feedback';
  const details = [
    row.app_version ? `PuckIQ ${row.app_version}${row.build ? ` (${row.build})` : ''}` : null,
    row.platform ? `${row.platform} ${row.os_version ?? ''}`.trim() : null,
    row.device,
    row.is_pro == null ? null : row.is_pro ? 'Pro' : 'Free',
  ].filter(Boolean).join(' · ');
  const subject = `PuckIQ feedback: ${label}`;
  const body = `${row.message}\n\n—\n${details}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
