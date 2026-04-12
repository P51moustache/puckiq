/**
 * User Sync Service
 * Migrates local AsyncStorage data to Supabase when a user first logs in.
 * This enables cross-device data persistence for authenticated users.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export const SYNC_STORAGE_KEY = 'puckiq_user_sync_completed';

// AsyncStorage keys to sync to Supabase
const SYNCABLE_KEYS = [
  'puckiq_daily_picks',
  'puckiq_favorite_teams',
  'puckiq_prediction_models',
] as const;

type SyncableKey = typeof SYNCABLE_KEYS[number];

interface SyncResult {
  synced: boolean;
  reason?: 'already_synced' | 'no_user' | 'error' | 'no_data';
  error?: string;
  keysUploaded?: SyncableKey[];
}

/**
 * Check if this user has already completed the initial data sync
 */
export async function hasCompletedInitialSync(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return false;

    const syncRecords: Record<string, string> = JSON.parse(raw);
    return !!syncRecords[userId];
  } catch (err) {
    console.warn('[USER SYNC] Failed to check sync status:', err);
    return false;
  }
}

/**
 * Mark the initial sync as complete for this user
 */
export async function markInitialSyncComplete(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STORAGE_KEY);
    const syncRecords: Record<string, string> = raw ? JSON.parse(raw) : {};
    syncRecords[userId] = new Date().toISOString();
    await AsyncStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncRecords));
  } catch (err) {
    console.warn('[USER SYNC] Failed to mark sync complete:', err);
  }
}

/**
 * Read local data for all syncable keys
 */
async function readLocalData(): Promise<Record<SyncableKey, any | null>> {
  const result = {} as Record<SyncableKey, any | null>;

  for (const key of SYNCABLE_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(key);
      result[key] = raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn(`[USER SYNC] Failed to read ${key}:`, err);
      result[key] = null;
    }
  }

  return result;
}

/**
 * Sync local AsyncStorage data to Supabase for the given user.
 * This runs once on first login -- subsequent logins skip the sync.
 *
 * Data is stored in the `user_data` table with the structure:
 *   { user_id, data_key, data_value (JSONB), updated_at }
 */
export async function syncLocalDataToSupabase(userId: string): Promise<SyncResult> {
  if (!userId) {
    return { synced: false, reason: 'no_user' };
  }

  try {
    // Check if already synced
    const alreadySynced = await hasCompletedInitialSync(userId);
    if (alreadySynced) {
      return { synced: false, reason: 'already_synced' };
    }

    // Read all local data
    const localData = await readLocalData();

    // Build upsert rows for keys that have data
    const keysToUpload: SyncableKey[] = [];
    const rows: Array<{
      user_id: string;
      data_key: string;
      data_value: any;
      updated_at: string;
    }> = [];

    for (const key of SYNCABLE_KEYS) {
      if (localData[key] != null) {
        keysToUpload.push(key);
        rows.push({
          user_id: userId,
          data_key: key,
          data_value: localData[key],
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Upload to Supabase if there's data to sync
    if (rows.length > 0) {
      const { error } = await supabase
        .from('user_data')
        .upsert(rows, { onConflict: 'user_id,data_key' });

      if (error) {
        console.error('[USER SYNC] Supabase upsert failed:', error.message);
        return { synced: false, reason: 'error', error: error.message };
      }

      console.log(`[USER SYNC] Synced ${keysToUpload.length} keys for user ${userId}`);
    } else {
      console.log('[USER SYNC] No local data to sync');
    }

    // Mark sync complete regardless (even if no data, the sync "happened")
    await markInitialSyncComplete(userId);

    return { synced: true, keysUploaded: keysToUpload };
  } catch (err: any) {
    console.error('[USER SYNC] Unexpected error:', err?.message || err);
    return { synced: false, reason: 'error', error: err?.message };
  }
}
