/**
 * Accuracy Trends Card - Displays prediction accuracy over time
 * Shows current accuracy, 7-day and 30-day averages, trend direction, and a chart
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { makeStyles, theme } from '../constants/theme';
import { getAccuracyTrends } from '../utils/accuracyTracking';
import type { AccuracyTrend } from '../types/predictions';
import { Skeleton, SkeletonText } from './ui/SkeletonLoader';
import { EmptyState } from './ui/EmptyState';

export default function AccuracyTrendsCard() {
  const styles = makeStyles();
  const [trends, setTrends] = useState<AccuracyTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrends() {
      try {
        const data = await getAccuracyTrends(30);
        setTrends(data);
      } catch (error) {
        console.error('[Accuracy Trends] Error loading trends:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTrends();
  }, []);

  // Chart configuration
  const screenWidth = Dimensions.get('window').width - 72; // Account for card padding and margins
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
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.accent,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: 'rgba(152, 166, 191, 0.1)',
    },
  };

  if (loading) {
    return (
      <View style={[styles.card, { padding: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Skeleton width={140} height={20} />
          <Skeleton width={80} height={24} borderRadius={12} />
        </View>
        <Skeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Skeleton width="48%" height={60} borderRadius={10} />
          <Skeleton width="48%" height={60} borderRadius={10} />
        </View>
      </View>
    );
  }

  if (!trends || trends.history.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 8 }}>
          Prediction Accuracy
        </Text>
        <EmptyState
          icon="stats-chart-outline"
          title="No Data Yet"
          message="Predictions will be tracked automatically after games complete. Make some picks to get started!"
        />
      </View>
    );
  }

  // Determine trend icon and color
  let trendIcon: keyof typeof Ionicons.glyphMap = 'remove-outline';
  let trendText = 'Stable';
  let trendColor = '#f59e0b';

  if (trends.trend === 'improving') {
    trendIcon = 'trending-up';
    trendText = 'Improving';
    trendColor = '#10b981';
  } else if (trends.trend === 'declining') {
    trendIcon = 'trending-down';
    trendText = 'Declining';
    trendColor = '#ef4444';
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8' }}>
          Prediction Accuracy
        </Text>
        <View style={{
          backgroundColor: `${trendColor}22`,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: `${trendColor}66`,
        }}>
          <Text style={{
            color: trendColor,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
          }}>
            <Ionicons name={trendIcon} size={10} color={trendColor} /> {trendText}
          </Text>
        </View>
      </View>

      {/* Current Accuracy */}
      <View style={{
        backgroundColor: '#192e5e66',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 12, color: '#98a6bf', marginBottom: 4, fontWeight: '600' }}>
          CURRENT ACCURACY
        </Text>
        <Text style={{ fontSize: 48, fontWeight: '900', color: '#10b981', letterSpacing: -2 }}>
          {trends.currentAccuracy}%
        </Text>
        <Text style={{ fontSize: 12, color: '#60a5fa', marginTop: 4 }}>
          Based on {trends.history.length} day{trends.history.length !== 1 ? 's' : ''} of predictions
        </Text>
      </View>

      {/* Averages Row */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* 7-Day Average */}
        <View style={{
          flex: 1,
          backgroundColor: '#071a3699',
          borderRadius: 10,
          padding: 12,
        }}>
          <Text style={{ fontSize: 10, color: '#98a6bf', marginBottom: 4, fontWeight: '600', textAlign: 'center' }}>
            7-DAY AVG
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#e6eef8', textAlign: 'center' }}>
            {trends.last7DaysAvg}%
          </Text>
        </View>

        {/* 30-Day Average */}
        <View style={{
          flex: 1,
          backgroundColor: '#071a3699',
          borderRadius: 10,
          padding: 12,
        }}>
          <Text style={{ fontSize: 10, color: '#98a6bf', marginBottom: 4, fontWeight: '600', textAlign: 'center' }}>
            30-DAY AVG
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#e6eef8', textAlign: 'center' }}>
            {trends.last30DaysAvg}%
          </Text>
        </View>
      </View>

      {/* Accuracy Chart */}
      {trends.history.length >= 3 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 12, fontWeight: '600' }}>
            ACCURACY TREND
          </Text>
          <View style={{ marginLeft: -16 }}>
            <LineChart
              data={{
                labels: trends.history
                  .slice(0, 10)
                  .reverse()
                  .map((d, i) => (i % 2 === 0 ? d.date.slice(-5) : '')), // Show every other label
                datasets: [{
                  data: trends.history
                    .slice(0, 10)
                    .reverse()
                    .map(d => d.overallAccuracy),
                  strokeWidth: 2,
                }],
              }}
              width={screenWidth}
              height={140}
              chartConfig={chartConfig}
              bezier
              style={{
                borderRadius: 12,
              }}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              yAxisSuffix="%"
              fromZero={false}
              segments={4}
            />
          </View>
          <Text style={{ fontSize: 10, color: '#60a5fa', marginTop: 4, textAlign: 'center' }}>
            Last {Math.min(10, trends.history.length)} days of predictions
          </Text>
        </View>
      )}

      {/* Mini History (fallback for less than 3 days) */}
      {trends.history.length > 0 && trends.history.length < 3 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 8, fontWeight: '600' }}>
            RECENT PERFORMANCE
          </Text>
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {trends.history.map((day) => {
              const dayAccuracy = day.overallAccuracy;
              let color = '#f59e0b'; // Moderate
              if (dayAccuracy >= 70) color = '#10b981'; // Good
              else if (dayAccuracy < 50) color = '#ef4444'; // Poor

              return (
                <View
                  key={day.date}
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: `${color}22`,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: `${color}66`,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color, fontSize: 10, fontWeight: '800' }}>
                    {dayAccuracy}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={{ fontSize: 10, color: '#60a5fa', marginTop: 6 }}>
            Need 3+ days for chart visualization
          </Text>
        </View>
      )}
    </View>
  );
}
