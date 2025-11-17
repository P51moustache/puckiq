/**
 * Accuracy Trends Card - Displays prediction accuracy over time
 * Shows current accuracy, 7-day and 30-day averages, and trend direction
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';
import { getAccuracyTrends } from '../utils/accuracyTracking';
import type { AccuracyTrend } from '../types/predictions';

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

  if (loading) {
    return (
      <View style={[styles.card, { padding: 20, alignItems: 'center' }]}>
        <ActivityIndicator size="small" color="#60a5fa" />
        <Text style={{ color: '#98a6bf', marginTop: 10, fontSize: 13 }}>
          Loading accuracy data...
        </Text>
      </View>
    );
  }

  if (!trends || trends.history.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 8 }}>
          Prediction Accuracy
        </Text>
        <Text style={{ color: '#98a6bf', fontSize: 13 }}>
          No accuracy data yet. Predictions will be tracked automatically after games complete.
        </Text>
      </View>
    );
  }

  // Determine trend emoji and color
  let trendEmoji = '➡️';
  let trendText = 'Stable';
  let trendColor = '#f59e0b';

  if (trends.trend === 'improving') {
    trendEmoji = '📈';
    trendText = 'Improving';
    trendColor = '#10b981';
  } else if (trends.trend === 'declining') {
    trendEmoji = '📉';
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
            {trendEmoji} {trendText}
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

      {/* Mini History */}
      {trends.history.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 8, fontWeight: '600' }}>
            RECENT PERFORMANCE
          </Text>
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {trends.history.slice(0, 10).map((day, index) => {
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
            Most recent {Math.min(10, trends.history.length)} days
          </Text>
        </View>
      )}
    </View>
  );
}
