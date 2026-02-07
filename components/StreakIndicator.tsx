import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Pick } from '../services/pickTracking';

interface StreakIndicatorProps {
  currentStreak: string; // "W5" or "L3"
  currentCount: number;
  bestWinStreak: number;
  worstLossStreak: number;
  recentPicks: Pick[]; // Last 20 picks for timeline
}

export default function StreakIndicator({
  currentStreak,
  currentCount,
  bestWinStreak,
  worstLossStreak,
  recentPicks,
}: StreakIndicatorProps) {
  const isWinStreak = currentStreak.startsWith('W');
  const isHot = isWinStreak && currentCount >= 3;
  const isCold = !isWinStreak && currentCount >= 3;

  // Get last 20 picks with outcomes for timeline
  const timelinePicks = recentPicks
    .filter(p => p.outcome && p.outcome !== 'push')
    .slice(0, 20)
    .reverse(); // Show oldest to newest

  return (
    <View style={styles.container}>
      {/* Current Streak */}
      <View style={styles.currentStreakContainer}>
        <Text style={styles.currentStreakLabel}>Current Streak</Text>
        <View style={[
          styles.streakBadge,
          isHot && styles.hotStreak,
          isCold && styles.coldStreak,
        ]}>
          <Text style={[
            styles.streakText,
            isHot && styles.hotStreakText,
            isCold && styles.coldStreakText,
          ]}>
            {currentStreak || '-'}
          </Text>
          {isHot && <Ionicons name="flame" size={16} color={theme.semantic.positive} />}
          {isCold && <Ionicons name="snow-outline" size={16} color={theme.accent} />}
        </View>
        {isHot && <Text style={styles.statusText}>Hot Hand!</Text>}
        {isCold && <Text style={styles.statusText}>Cold Streak</Text>}
      </View>

      {/* Best/Worst Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Best Streak</Text>
          <Text style={[styles.statValue, { color: theme.semantic.positive }]}>
            {bestWinStreak > 0 ? `W${bestWinStreak}` : '-'}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Worst Streak</Text>
          <Text style={[styles.statValue, { color: theme.semantic.negative }]}>
            {worstLossStreak > 0 ? `L${worstLossStreak}` : '-'}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      {timelinePicks.length > 0 && (
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineLabel}>Last {timelinePicks.length} Picks</Text>
          <View style={styles.timeline}>
            {timelinePicks.map((pick, idx) => (
              <View
                key={`${pick.gameId}-${idx}`}
                style={[
                  styles.timelineDot,
                  pick.outcome === 'win' && styles.timelineDotWin,
                  pick.outcome === 'loss' && styles.timelineDotLoss,
                ]}
              >
                <Text style={styles.timelineDotText}>
                  {pick.outcome === 'win' ? 'W' : 'L'}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabel}>Oldest</Text>
            <Text style={styles.timelineLabel}>Recent</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  currentStreakContainer: {
    alignItems: 'center',
    gap: 8,
  },
  currentStreakLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.factbox,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#60a5fa44',
  },
  hotStreak: {
    backgroundColor: '#10b98122',
    borderColor: theme.semantic.positive,
  },
  coldStreak: {
    backgroundColor: '#ef444422',
    borderColor: theme.semantic.negative,
  },
  streakText: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.text,
  },
  hotStreakText: {
    color: theme.semantic.positive,
  },
  coldStreakText: {
    color: theme.semantic.negative,
  },
  emoji: {
    fontSize: 28,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#071a3699',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: theme.subtext,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  timelineContainer: {
    gap: 8,
  },
  timelineLabel: {
    fontSize: 10,
    color: theme.subtext,
    fontWeight: '600',
  },
  timeline: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.factbox,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#192e5e44',
  },
  timelineDotWin: {
    backgroundColor: '#10b98133',
    borderColor: theme.semantic.positive,
  },
  timelineDotLoss: {
    backgroundColor: '#ef444433',
    borderColor: theme.semantic.negative,
  },
  timelineDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.text,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
