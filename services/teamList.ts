/**
 * teamList — minimal "all 32 teams" loader for picker UIs.
 *
 * Pulls the latest standings snapshot to get every active team's abbrev +
 * full name. Cached in module memory for the session — no need to refetch.
 */

import { supabase } from '../lib/supabase';

export interface SimpleTeam {
  abbrev: string;
  name: string;
}

let cache: SimpleTeam[] | null = null;

export async function fetchAllTeams(): Promise<SimpleTeam[]> {
  if (cache) return cache;

  const { data, error } = await supabase
    .from('standings')
    .select('team_abbrev, snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(64);

  if (error || !data) {
    console.warn('[teamList] Supabase query failed:', error?.message);
    return [];
  }

  // Latest snapshot has 32 unique teams
  const seen = new Set<string>();
  const out: SimpleTeam[] = [];
  for (const row of data) {
    const ab = (row as any).team_abbrev;
    if (!ab || seen.has(ab)) continue;
    seen.add(ab);
    out.push({ abbrev: ab, name: ab });
  }
  out.sort((a, b) => a.abbrev.localeCompare(b.abbrev));
  cache = out;
  return out;
}

export function clearTeamListCache() {
  cache = null;
}
