/**
 * The League Room's only door to Supabase. The API talks to the narrow LeagueBackend port, so
 * tests (or another transport) swap it without faking a whole client, and this file is the one
 * place that knows supabase-js.
 */

import { isSupabaseConfigured, supabase, type SupabaseClient } from '../../lib/supabase';

export type LeagueTable = 'rooms' | 'room_members' | 'room_dues_status' | 'room_reactions';

/** PostgREST's resolved shape: `error` set on failure, `data` otherwise. */
export interface BackendResult {
  data: unknown;
  error: unknown;
  /** HTTP status, when the transport reports one (supabase-js does): 404 = no such function or table. */
  status?: number;
}

/** `select columns from table where column = value [order by …] [limit …]` — all RLS-filtered. */
export interface SelectQuery {
  table: LeagueTable;
  columns: string;
  match: { column: string; value: string };
  order?: { column: string; ascending: boolean };
  limit?: number;
}

export interface LeagueBackend {
  /** Calls a Postgres function with `p_`-named args. */
  rpc(name: string, args: Record<string, unknown>): PromiseLike<BackendResult>;
  select(query: SelectQuery): PromiseLike<BackendResult>;
  /** The signed-in user's id, or null when there's no session. */
  currentUserId(): Promise<string | null>;
}

export interface LeagueApiDeps {
  backend: LeagueBackend;
  /** False in builds without Supabase keys: every call fails fast with `not_configured`. */
  configured: boolean;
}

export function supabaseLeagueBackend(client: SupabaseClient): LeagueBackend {
  return {
    rpc: (name, args) => client.rpc(name, args),
    select: ({ table, columns, match, order, limit }) => {
      let query = client.from(table).select(columns).eq(match.column, match.value);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit !== undefined) query = query.limit(limit);
      return query;
    },
    currentUserId: async () => {
      const { data } = await client.auth.getSession();
      return data.session?.user?.id ?? null;
    },
  };
}

/** The app's wiring: the shared Supabase client, and whether this build has keys. */
export function defaultLeagueDeps(): LeagueApiDeps {
  return { backend: supabaseLeagueBackend(supabase), configured: isSupabaseConfigured };
}
