/**
 * Optional backup of fantasy teams for signed-in users (Supabase `user_data`,
 * one row per user per key, owner-only RLS). Local-first: the app never waits on it.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { TeamsState } from '../types/fantasy';
import { parseTeamsState } from './teams';

export const CLOUD_TEAMS_KEY = 'puckiq_teams_v3';

/** Union by team id; the more recently edited copy of a team wins. */
export function mergeTeamsStates(local: TeamsState, remote: TeamsState): TeamsState {
  const byId = new Map(local.teams.map((team) => [team.id, team]));
  for (const team of remote.teams) {
    const mine = byId.get(team.id);
    if (!mine || Date.parse(team.updatedAt) > Date.parse(mine.updatedAt)) byId.set(team.id, team);
  }
  const order = [...local.teams.map((team) => team.id), ...remote.teams.map((team) => team.id)];
  const teams = [...new Set(order)].map((id) => byId.get(id)!).filter(Boolean);
  const activeTeamId = teams.some((team) => team.id === local.activeTeamId)
    ? local.activeTeamId
    : teams.some((team) => team.id === remote.activeTeamId)
      ? remote.activeTeamId
      : teams[0]?.id ?? null;
  return { activeTeamId, teams };
}

export async function pullTeams(userId: string): Promise<TeamsState | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('data_value')
    .eq('user_id', userId)
    .eq('data_key', CLOUD_TEAMS_KEY)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  return row?.data_value ? parseTeamsState(row.data_value) : null;
}

export async function pushTeams(userId: string, state: TeamsState): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('user_data').upsert(
    { user_id: userId, data_key: CLOUD_TEAMS_KEY, data_value: state, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,data_key' },
  );
  if (error) throw new Error(error.message);
}

/**
 * Delete the account. Uses the `delete-account` edge function (removes the auth user;
 * user_data cascades). If the function isn't deployed, at least wipe this user's rows.
 */
export async function deleteAccount(userId: string): Promise<'deleted' | 'data_only'> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (!error) return 'deleted';
  await supabase.from('user_data').delete().eq('user_id', userId);
  await supabase.from('push_tokens').delete().eq('user_id', userId);
  await supabase.from('notification_preferences').delete().eq('user_id', userId);
  return 'data_only';
}
