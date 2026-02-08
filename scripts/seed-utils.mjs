/**
 * Shared utilities for NHL seeding scripts.
 * Provides Supabase client, rate-limited fetch, progress logging, and batch upsert.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ============================================
// Supabase Client
// ============================================

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Prefer service role key for write operations in seed scripts
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const keyType = supabaseServiceKey ? 'service_role' : 'anon';
console.log(`[Seed Utils] Supabase key type: ${keyType}`);

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// Constants
// ============================================

export const SEASON = 20252026;
export const SEASON_STR = '20252026';

export const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
  'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
  'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
  'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
];

export const NHL_API = 'https://api-web.nhle.com/v1';

// ============================================
// Rate-limited fetch
// ============================================

let lastFetchTime = 0;
const MIN_DELAY_MS = 500; // ~2 requests/sec — very conservative for NHL API

export async function fetchNHL(path, retries = 5) {
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastFetchTime = Date.now();

  const url = path.startsWith('http') ? path : `${NHL_API}${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, { redirect: 'follow' });
    if (response.ok) {
      return response.json();
    }
    if (response.status === 429 && attempt < retries) {
      // Rate limited — back off exponentially with longer waits
      const backoff = 3000 * Math.pow(2, attempt - 1); // 3s, 6s, 12s, 24s
      process.stdout.write(`\r  [429] Backing off ${backoff / 1000}s for ${path}...      `);
      await sleep(backoff);
      lastFetchTime = Date.now();
      continue;
    }
    if (response.status === 404) {
      return null;
    }
    if (attempt === retries) {
      throw new Error(`HTTP ${response.status} for ${url} after ${retries} attempts`);
    }
    await sleep(2000 * attempt);
  }
}

// ============================================
// Batch upsert
// ============================================

export async function batchUpsert(table, rows, conflictColumns, batchSize = 200) {
  if (rows.length === 0) return 0;

  let totalUpserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictColumns });

    if (error) {
      console.error(`  [${table}] Batch upsert error at index ${i}:`, error.message);
    } else {
      totalUpserted += batch.length;
    }
  }
  return totalUpserted;
}

// ============================================
// Sync log helpers
// ============================================

export async function startSync(syncType) {
  const { data, error } = await supabase
    .from('sync_log')
    .insert({ sync_type: syncType, status: 'running' })
    .select('id')
    .single();

  if (error) {
    console.warn(`[SYNC LOG] Failed to create log entry:`, error.message);
    return null;
  }
  return data.id;
}

export async function completeSync(syncId, recordsProcessed) {
  if (!syncId) return;
  await supabase
    .from('sync_log')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    })
    .eq('id', syncId);
}

export async function failSync(syncId, errorMessage) {
  if (!syncId) return;
  await supabase
    .from('sync_log')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq('id', syncId);
}

// ============================================
// Utilities
// ============================================

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function progress(current, total, label) {
  const pct = Math.round((current / total) * 100);
  process.stdout.write(`\r  [${pct}%] ${current}/${total} ${label}`);
  if (current === total) process.stdout.write('\n');
}

/** Parse TOI string "MM:SS" to seconds */
export function toiToSeconds(toi) {
  if (!toi) return null;
  const parts = toi.split(':');
  if (parts.length !== 2) return null;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Extract .default from NHL name field */
export function nameDefault(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.default || '';
}

/** Parse "21/22" style string to extract numerator */
export function parseShotsStr(str) {
  if (!str) return null;
  const parts = str.split('/');
  return parts.length === 2 ? parseInt(parts[1], 10) : null;
}

/** Parse "21/22" style string to extract saves (first number) */
export function parseSavesStr(str) {
  if (!str) return null;
  const parts = str.split('/');
  return parts.length === 2 ? parseInt(parts[0], 10) : null;
}
