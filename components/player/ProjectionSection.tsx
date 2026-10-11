import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SeasonEstimate } from '../../services/fantasy/playerOutlook';
import { colors, Card, SectionLabel, LoadingRows } from '../coach/ui';

export function ProjectionSection({
  estimate,
  loading,
  error,
}: {
  estimate: SeasonEstimate | null;
  loading: boolean;
  error?: string | null;
}) {
  return (
    <View testID="player-projection">
      <SectionLabel
        title="Rest of season projection"
        right={
          estimate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How this season estimate is calculated"
              hitSlop={10}
              onPress={() => Alert.alert('Season estimate', estimate.basis)}
            >
              <Text style={styles.meta}>ESTIMATE ⓘ</Text>
            </Pressable>
          ) : null
        }
      />
      {loading && !estimate ? (
        <LoadingRows count={1} />
      ) : estimate ? (
        <>
          <View style={styles.tiles}>
            {estimate.metrics.map((metric) => (
              <Card key={metric.label} style={styles.tile}>
                <Text style={styles.number}>{metric.value}</Text>
                <Text style={styles.label}>{metric.label}</Text>
              </Card>
            ))}
          </View>
        </>
      ) : (
        <Card>
          <Text style={styles.note}>
            {error
              ? 'Season outlook unavailable. Pull to refresh and try again.'
              : 'A published schedule and NHL stats are needed for a season estimate.'}
          </Text>
        </Card>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  meta: { fontSize: 10, letterSpacing: 1, color: colors.muted },
  tiles: { flexDirection: 'row', gap: 5 },
  tile: { flex: 1, alignItems: 'center', padding: 6, borderRadius: 7 },
  number: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  label: { fontSize: 11, color: colors.sub, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 9 },
});
