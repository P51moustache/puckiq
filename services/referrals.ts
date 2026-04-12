import { Share } from 'react-native';
import { supabase } from '../lib/supabase';

const DEEP_LINK_PREFIX = 'exp+learning-project://';

/**
 * Generate a referral deep link for the given user.
 */
export function generateReferralLink(userId: string): string {
  return `${DEEP_LINK_PREFIX}referral?code=${encodeURIComponent(userId)}`;
}

/**
 * Handle an incoming referral code (from deep link).
 * Records the referral in Supabase and returns true if valid.
 */
export async function handleReferralCode(
  code: string,
  referredUserId?: string
): Promise<boolean> {
  try {
    if (!code || !code.trim()) {
      console.warn('[Referrals] Empty referral code');
      return false;
    }

    const { error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: code.trim(),
        referred_id: referredUserId ?? null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[Referrals] Failed to record referral:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Referrals] Unexpected error:', err);
    return false;
  }
}

/**
 * Open the native share sheet with a referral invite link.
 */
export async function shareReferralLink(userId: string): Promise<boolean> {
  try {
    const link = generateReferralLink(userId);
    const result = await Share.share({
      message: `Join me on PuckIQ for NHL predictions! ${link}`,
      url: link,
    });

    return result.action === Share.sharedAction;
  } catch (err) {
    console.warn('[Referrals] Share failed:', err);
    return false;
  }
}

/**
 * Get the count of successful referrals for a user.
 */
export async function getReferralCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', userId);

    if (error || !data) {
      return 0;
    }

    return data.length;
  } catch {
    return 0;
  }
}
