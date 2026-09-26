import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase only backs optional sign-in + team backup. The coach runs on public NHL
 * data, so a build without keys must still launch — never throw at import time.
 */
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

/**
 * Whether Sign in with Apple is switched on for this Supabase project (public
 * /auth/v1/settings). Lets the app hide sign-in instead of showing a button that fails.
 */
export async function isAppleSignInEnabled(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey as string } });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { apple?: boolean } };
    return settings.external?.apple === true;
  } catch {
    return false;
  }
}

if (!isSupabaseConfigured) {
  console.warn('[Supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing. Sign-in and backup are disabled.');
}

// Safe storage adapter that handles web SSR (where window is undefined)
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null; // SSR: no storage available
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return; // SSR: no-op
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return; // SSR: no-op
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl || 'https://not-configured.supabase.co',
  supabaseAnonKey || 'not-configured',
  {
    auth: {
      storage: safeStorage,
      autoRefreshToken: isSupabaseConfigured,
      persistSession: true,
      detectSessionInUrl: false, // Expo handles deep links manually
    },
  },
);

export type SupabaseClient = typeof supabase;
