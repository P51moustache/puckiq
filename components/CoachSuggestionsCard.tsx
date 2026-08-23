import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { rinkGlass } from '../constants/theme';
import {
  LINEUP_HOST_NOTE,
  buildCoachSuggestions,
  visibleCoachSuggestions,
} from '../services/coachSuggestions';
import type { TonightPlayerStatus } from '../types/fantasy';
import { useSubscription } from './SubscriptionProvider';
import ProPaywall from './ProPaywall';
import { isPaywallEnabled } from '../constants/monetization';

const ACTION_COLOR = {
  START: rinkGlass.faceoffDot,
  SIT: rinkGlass.redLine,
  DROP: rinkGlass.powerPlay,
};

export default function CoachSuggestionsCard({
  statuses,
}: {
  statuses: TonightPlayerStatus[];
}) {
  const { isPremium } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const all = useMemo(() => buildCoachSuggestions(statuses), [statuses]);
  const visible = useMemo(
    () => visibleCoachSuggestions(all, isPremium),
    [all, isPremium],
  );

  if (all.length === 0) return null;

  return (
    <View style={styles.card} testID="coach-suggestions">
      <Text style={styles.kicker}>COACH</Text>
      <Text style={styles.title}>Change it in their app</Text>
      {visible.map((row) => (
        <View key={row.id} style={styles.row} testID={`coach-${row.action.toLowerCase()}`}>
          <Text style={[styles.action, { color: ACTION_COLOR[row.action] }]}>{row.action}</Text>
          <View style={styles.copy}>
            <Text style={styles.name}>{row.playerName}</Text>
            <Text style={styles.detail}>{row.detail}</Text>
          </View>
        </View>
      ))}
      {!isPremium && all.length > 1 ? (
        <TouchableOpacity
          onPress={() => isPaywallEnabled() && setShowPaywall(true)}
          testID="coach-unlock"
        >
          <Text style={styles.unlock}>
            {`Pro coach: ${all.length - 1} more sit / start / drop calls`}
          </Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.hostNote} testID="coach-host-note">{LINEUP_HOST_NOTE}</Text>
      <ProPaywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.glass,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: rinkGlass.blueLight,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  action: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    width: 52,
    paddingTop: 2,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  detail: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginTop: 2,
  },
  unlock: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
  hostNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: rinkGlass.textMuted,
  },
});
