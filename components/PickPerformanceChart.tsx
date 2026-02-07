/**
 * Pick Performance Chart - Compares accuracy across pick types
 * Shows Best Bet vs Smart Picks vs Your Picks in a bar chart
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { makeStyles, theme } from '../constants/theme';
import { getLockStats, getSmartPickStats, getUserPickStats, PickStats } from '../services/pickTracking';
import { Skeleton } from './ui/SkeletonLoader';
import { EmptyState } from './ui/EmptyState';

type TimeRange = '7d' | '30d' | 'all';

interface PickPerformanceChartProps {
  onRefresh?: () => void;
}

export default function PickPerformanceChart({ onRefresh }: PickPerformanceChartProps) {
  const styles = makeStyles();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [lockStats, setLockStats] = useState<PickStats | null>(null);
  const [smartStats, setSmartStats] = useState<PickStats | null>(null);
  const [userStats, setUserStats] = useState<PickStats | null>(null);

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width - 72;
  const chartConfig = {
    backgroundColor: theme.card,
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(152, 166, 191, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    barPercentage: 0.6,
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: 'rgba(152, 166, 191, 0.1)',
    },
  };

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [lock, smart, user] = await Promise.all([
          getLockStats(),
          getSmartPickStats(),
          getUserPickStats(),
        ]);
        setLockStats(lock);
        setSmartStats(smart);
        setUserStats(user);
      } catch (error) {
        console.error('[PickPerformanceChart] Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [timeRange]);

  // Calculate accuracy for each type
  const getAccuracy = (stats: PickStats | null): number => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.wins / stats.total) * 100);
  };

  const lockAccuracy = getAccuracy(lockStats);
  const smartAccuracy = getAccuracy(smartStats);
  const userAccuracy = getAccuracy(userStats);

  // Check if we have any data
  const hasData = (lockStats?.total || 0) + (smartStats?.total || 0) + (userStats?.total || 0) > 0;

  // Get color based on accuracy
  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 60) return '#10b981';
    if (accuracy >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <View style={[styles.card, { padding: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Skeleton width={160} height={20} />
          <Skeleton width={100} height={28} borderRadius={14} />
        </View>
        <Skeleton width="100%" height={180} borderRadius={12} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Skeleton width={80} height={40} />
          <Skeleton width={80} height={40} />
          <Skeleton width={80} height={40} />
        </View>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={styles.card}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 8 }}>
          Pick Performance
        </Text>
        <EmptyState
          icon="trending-up-outline"
          title="No Picks Yet"
          message="Start making picks to see how different pick types compare!"
        />
      </View>
    );
  }

  // Prepare chart data - only include types with data
  const chartLabels: string[] = [];
  const chartData: number[] = [];
  const barColors: string[] = [];

  if (lockStats && lockStats.total > 0) {
    chartLabels.push('Best Bet');
    chartData.push(lockAccuracy);
    barColors.push(getAccuracyColor(lockAccuracy));
  }
  if (smartStats && smartStats.total > 0) {
    chartLabels.push('Smart');
    chartData.push(smartAccuracy);
    barColors.push(getAccuracyColor(smartAccuracy));
  }
  if (userStats && userStats.total > 0) {
    chartLabels.push('Your Picks');
    chartData.push(userAccuracy);
    barColors.push(getAccuracyColor(userAccuracy));
  }

  return (
    <View style={styles.card}>
      {/* Header with Time Range Selector */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8' }}>
          Pick Performance
        </Text>
        <View style={localStyles.timeRangeContainer}>
          {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                localStyles.timeRangeButton,
                timeRange === range && localStyles.timeRangeButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  localStyles.timeRangeText,
                  timeRange === range && localStyles.timeRangeTextActive,
                ]}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <View style={{ marginLeft: -16 }}>
          <BarChart
            data={{
              labels: chartLabels,
              datasets: [{ data: chartData }],
            }}
            width={screenWidth}
            height={180}
            yAxisLabel=""
            yAxisSuffix="%"
            chartConfig={{
              ...chartConfig,
              fillShadowGradientFrom: theme.accent,
              fillShadowGradientTo: theme.accent,
            }}
            style={{
              borderRadius: 12,
            }}
            fromZero={true}
            showValuesOnTopOfBars={true}
          />
        </View>
      )}

      {/* Stats Summary */}
      <View style={localStyles.statsRow}>
        {lockStats && lockStats.total > 0 && (
          <View style={localStyles.statItem}>
            <View style={[localStyles.statDot, { backgroundColor: getAccuracyColor(lockAccuracy) }]} />
            <Text style={localStyles.statLabel}>Best Bet</Text>
            <Text style={[localStyles.statValue, { color: getAccuracyColor(lockAccuracy) }]}>
              {lockStats.wins}-{lockStats.losses}
            </Text>
          </View>
        )}
        {smartStats && smartStats.total > 0 && (
          <View style={localStyles.statItem}>
            <View style={[localStyles.statDot, { backgroundColor: getAccuracyColor(smartAccuracy) }]} />
            <Text style={localStyles.statLabel}>Smart</Text>
            <Text style={[localStyles.statValue, { color: getAccuracyColor(smartAccuracy) }]}>
              {smartStats.wins}-{smartStats.losses}
            </Text>
          </View>
        )}
        {userStats && userStats.total > 0 && (
          <View style={localStyles.statItem}>
            <View style={[localStyles.statDot, { backgroundColor: getAccuracyColor(userAccuracy) }]} />
            <Text style={localStyles.statLabel}>Yours</Text>
            <Text style={[localStyles.statValue, { color: getAccuracyColor(userAccuracy) }]}>
              {userStats.wins}-{userStats.losses}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: theme.subtle,
    borderRadius: 8,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeRangeButtonActive: {
    backgroundColor: theme.accent,
  },
  timeRangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  timeRangeTextActive: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
  },
  statItem: {
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: theme.subtext,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});
