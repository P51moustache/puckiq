import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
          {isHot && <Text style={styles.emoji}>🔥</Text>}
          {isCold && <Text style={styles.emoji}>❄️</Text>}
        </View>
        {isHot && <Text style={styles.statusText}>Hot Hand!</Text>}
        {isCold && <Text style={styles.statusText}>Cold Streak</Text>}
      </View>

      {/* Best/Worst Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Best Streak</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {bestWinStreak > 0 ? `W${bestWinStreak}` : '-'}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Worst Streak</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>
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
    backgroundColor: '#192e5eff',
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
    color: '#98a6bf',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#334e8dff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#60a5fa44',
  },
  hotStreak: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  coldStreak: {
    backgroundColor: '#ef444422',
    borderColor: '#ef4444',
  },
  streakText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#e6eef8',
  },
  hotStreakText: {
    color: '#10b981',
  },
  coldStreakText: {
    color: '#ef4444',
  },
  emoji: {
    fontSize: 28,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
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
    color: '#98a6bf',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#e6eef8',
  },
  timelineContainer: {
    gap: 8,
  },
  timelineLabel: {
    fontSize: 10,
    color: '#98a6bf',
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
    backgroundColor: '#334e8dff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#192e5e44',
  },
  timelineDotWin: {
    backgroundColor: '#10b98133',
    borderColor: '#10b981',
  },
  timelineDotLoss: {
    backgroundColor: '#ef444433',
    borderColor: '#ef4444',
  },
  timelineDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e6eef8',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
