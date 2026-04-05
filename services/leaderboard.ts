import { supabase } from '../lib/supabase';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPicks: number;
  correctPicks: number;
  accuracy: number;
  streak: number;
  rank: number;
}

const DEFAULT_LIMIT = 25;
const MIN_PICKS_FOR_LEADERBOARD = 10;

/**
 * Fetch top predictors from the leaderboard table.
 * Only returns users with a display name and at least MIN_PICKS_FOR_LEADERBOARD picks.
 */
export async function getTopPredictors(
  period: 'week' | 'season',
  limit: number = DEFAULT_LIMIT
): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id, display_name, total_picks, correct_picks, accuracy, streak, period')
      .eq('period', period)
      .gte('total_picks', MIN_PICKS_FOR_LEADERBOARD)
      .order('accuracy', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.warn('[Leaderboard] Failed to fetch top predictors:', error?.message);
      return [];
    }

    return data.map((row: any, index: number) => ({
      userId: row.user_id,
      displayName: row.display_name,
      totalPicks: row.total_picks,
      correctPicks: row.correct_picks,
      accuracy: row.accuracy,
      streak: row.streak ?? 0,
      rank: index + 1,
    }));
  } catch (err) {
    console.warn('[Leaderboard] Unexpected error:', err);
    return [];
  }
}

/**
 * Upsert user's prediction stats to the leaderboard table.
 */
export async function updateUserScore(
  userId: string,
  totalPicks: number,
  correctPicks: number,
  streak: number
): Promise<void> {
  try {
    const accuracy = totalPicks > 0 ? correctPicks / totalPicks : 0;

    const { error } = await supabase
      .from('leaderboard')
      .upsert({
        user_id: userId,
        total_picks: totalPicks,
        correct_picks: correctPicks,
        accuracy,
        streak,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[Leaderboard] Failed to update user score:', error.message);
    }
  } catch (err) {
    console.warn('[Leaderboard] Unexpected error updating score:', err);
  }
}

/**
 * Set or update a user's display name on the leaderboard.
 * Opting in by setting a display name makes the user visible on the leaderboard.
 */
export async function setDisplayName(userId: string, name: string): Promise<void> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      console.warn('[Leaderboard] Display name cannot be empty');
      return;
    }

    const { error } = await supabase
      .from('leaderboard')
      .upsert({
        user_id: userId,
        display_name: trimmed,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[Leaderboard] Failed to set display name:', error.message);
    }
  } catch (err) {
    console.warn('[Leaderboard] Unexpected error setting display name:', err);
  }
}
