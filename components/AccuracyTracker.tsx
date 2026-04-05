import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { theme } from '../constants/theme';
import { getAccuracyStats, type AccuracyStats } from '../services/accuracyStats';

const CHART_WIDTH = Dimensions.get('window').width - 64; // 16px padding each side + 16px card padding each side

export default function AccuracyTracker() {
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await getAccuracyStats();
      setStats(data);
    } catch (error) {
      console.error('[AccuracyTracker] Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!stats || stats.totalPicks === 0) return;
    const pct = Math.round(stats.accuracy * 100);
    try {
      await Share.share({
        message: `My PuckIQ pick accuracy: ${pct}% (${stats.correctPicks}/${stats.totalPicks}) | Current streak: ${stats.currentStreak} | Best streak: ${stats.bestStreak}`,
      });
    } catch {
      // User cancelled
    }
  }

  if (loading) return null;

  // Empty state
  if (!stats || stats.totalPicks === 0) {
    return (
      <View style={styles.container} testID="accuracy-tracker">
        <Text style={styles.sectionTitle}>Your Accuracy</Text>
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            Make some picks to start tracking your accuracy!
          </Text>
        </View>
      </View>
    );
  }

  const pct = Math.round(stats.accuracy * 100);
  const last7Pct = stats.last7Days.total > 0 ? Math.round(stats.last7Days.accuracy * 100) : null;
  const last30Pct = stats.last30Days.total > 0 ? Math.round(stats.last30Days.accuracy * 100) : null;

  // Chart data — show last 14 days max
  const chartData = stats.dailyAccuracy.slice(-14);
  const hasChartData = chartData.length >= 2;

  return (
    <View style={styles.container} testID="accuracy-tracker">
      <Text style={styles.sectionTitle}>Your Accuracy</Text>

      <View style={styles.card}>
        {/* Big accuracy number */}
        <View style={styles.bigNumberRow}>
          <Text style={styles.bigNumber} testID="accuracy-percentage">{pct}%</Text>
          <Text style={styles.bigNumberLabel}>
            {stats.correctPicks}/{stats.totalPicks} correct
          </Text>
        </View>

        {/* Streaks */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="current-streak">{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="best-streak">{stats.bestStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>

        {/* Rolling windows */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="last-7-days">
              {last7Pct !== null ? `${last7Pct}%` : '--'}
            </Text>
            <Text style={styles.statLabel}>Last 7 Days</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="last-30-days">
              {last30Pct !== null ? `${last30Pct}%` : '--'}
            </Text>
            <Text style={styles.statLabel}>Last 30 Days</Text>
          </View>
        </View>

        {/* Chart */}
        {hasChartData && (
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: chartData.map(d => {
                  const parts = d.date.split('-');
                  return `${parts[1]}/${parts[2]}`;
                }),
                datasets: [{
                  data: chartData.map(d => Math.round(d.accuracy * 100)),
                }],
              }}
              width={CHART_WIDTH}
              height={160}
              yAxisSuffix="%"
              yAxisInterval={1}
              fromZero
              chartConfig={{
                backgroundColor: theme.card,
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(152, 166, 191, ${opacity})`,
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: theme.accent,
                },
                propsForLabels: {
                  fontSize: 10,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Share button */}
        <Pressable
          style={styles.shareButton}
          onPress={handleShare}
          testID="share-stats-button"
        >
          <Text style={styles.shareButtonText}>Share My Stats</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    ...theme.elevation.low,
  },
  emptyText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    paddingVertical: 20,
  },
  bigNumberRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.accent,
  },
  bigNumberLabel: {
    fontSize: 13,
    color: theme.subtext,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 2,
  },
  chartContainer: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 10,
  },
  shareButton: {
    marginTop: 12,
    backgroundColor: theme.factbox,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareButtonText: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
