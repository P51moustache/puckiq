import { supabase } from '../lib/supabase';

export interface RosterPlayerSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbrev: string;
  position: string;
}

export async function searchRosterPlayers(rawQuery: string): Promise<RosterPlayerSearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];
  const pattern = `%${query.replace(/[,%]/g, '')}%`;
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, full_name, current_team_abbrev, position')
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},full_name.ilike.${pattern}`)
    .eq('is_active', true)
    .limit(20);
  if (error || !data) throw new Error(error?.message || 'Player search unavailable');
  return data.map((row: any) => ({
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    teamAbbrev: row.current_team_abbrev || '',
    position: row.position || '',
  }));
}
