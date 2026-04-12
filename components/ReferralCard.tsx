import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { useAuthContext } from './auth/AuthProvider';
import { shareReferralLink, getReferralCount } from '../services/referrals';

export default function ReferralCard() {
  const { user } = useAuthContext();
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (user) {
      getReferralCount(user.id).then(setReferralCount);
    }
  }, [user]);

  const handleShare = useCallback(async () => {
    if (!user) return;
    await shareReferralLink(user.id);
  }, [user]);

  if (!user) return null;

  return (
    <View style={styles.card} testID="referral-card">
      <Text style={styles.title}>Give a Month, Get a Month</Text>
      <Text style={styles.subtitle}>
        Share PuckIQ with a friend — you both get 1 month of Pro free
      </Text>

      <Pressable style={styles.shareButton} onPress={handleShare} testID="share-referral-button">
        <Text style={styles.shareButtonText}>Share Invite Link</Text>
      </Pressable>

      {referralCount > 0 && (
        <Text style={styles.referralCount} testID="referral-count">
          {referralCount} friend{referralCount !== 1 ? 's' : ''} referred
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: theme.spacing.md,
    ...theme.elevation.low,
  },
  title: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold as '600',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.subtext,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  shareButton: {
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: theme.typography.weights.bold as '700',
    fontSize: theme.typography.sizes.sm,
  },
  referralCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
