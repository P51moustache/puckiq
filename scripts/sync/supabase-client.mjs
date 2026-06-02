/**
 * Supabase client for sync scripts.
 * Uses service role key if available, falls back to anon key.
 * Loads env vars from .env file if present.
 */

import { createClient } from '@supabase/supabase-js';

// Load .env if available (for local runs)
try {
  const { config } = await import('dotenv');
  config();
} catch {
  // dotenv not installed or .env not found — env vars must be set externally (e.g., GitHub Actions)
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Prefer service role key for write operations in sync scripts
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

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
  const keyType = supabaseServiceKey ? 'service_role' : 'anon';
  console.log(`[Supabase] Connected to ${supabaseUrl} (key: ${keyType})`);
}
