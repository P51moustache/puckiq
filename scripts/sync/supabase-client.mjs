/**
 * Supabase client for sync scripts.
 * Requires a server credential; never falls back to the public app key.
 * Loads env vars from .env file if present.
 */

import { createClient } from '@supabase/supabase-js';
import { loadSyncEnv, writerConfig } from './runtime-config.mjs';

loadSyncEnv();
const {url:supabaseUrl,key:supabaseKey} = writerConfig(process.env);

// Newer @supabase/supabase-js (realtime-js) eagerly constructs a RealtimeClient
// when the SupabaseClient is created, and on Node < 22 that throws:
//   "Node.js 20 detected without native WebSocket support."
// Sync scripts only do REST reads/writes — never realtime subscriptions — but the
// client is built regardless. Supply the `ws` package as the realtime transport so
// construction succeeds on any Node version. `ws` is optional: on Node 22+ (native
// WebSocket) or if it isn't installed, we fall back to default options.
let realtimeOptions;
try {
  const { default: ws } = await import('ws');
  realtimeOptions = { realtime: { transport: ws } };
} catch {
  realtimeOptions = {};
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...realtimeOptions,
});

/**
 * Log which key type is being used (for debugging).
 */
export function logConnectionInfo() {
  console.log('[Supabase] Server write client configured.');
}
