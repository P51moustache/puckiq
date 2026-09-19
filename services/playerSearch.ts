import { supabase } from '../lib/supabase';
import type { PlayerSearchResult } from './playerLeaders';

/** Search that preserves the distinction between no matches and unavailable data. */
export async function searchActivePlayers(query: string, limit = 20): Promise<PlayerSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, full_name, position, current_team_abbrev, headshot_url, sweater_number')
    .ilike('full_name', `%${trimmed}%`)
    .eq('is_active', true)
    .limit(limit);
  if (error || !data) throw new Error(error?.message || 'Player search unavailable');
  return data.map((row: any) => ({
    playerId: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    position: row.position || '',
    teamAbbrev: row.current_team_abbrev || '',
    headshotUrl: row.headshot_url ?? undefined,
    sweaterNumber: row.sweater_number ?? undefined,
  }));
}
