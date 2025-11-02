import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';

interface PowerRankingsWidgetProps {
  rankings: any[];
}

export default function PowerRankingsWidget({ rankings }: PowerRankingsWidgetProps) {
  const styles = makeStyles();

  if (!rankings || rankings.length === 0) return null;

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return '#10b981';
    if (trend === 'down') return '#ef4444';
    return '#98a6bf';
  };

  return (
    <View style={{
      backgroundColor: styles.card.backgroundColor,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    }}>
      {/* Header */}
      <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '800',
          color: '#e6eef8',
        }}>
          Power Rankings
        </Text>
        <Text style={{
          fontSize: 11,
          color: '#98a6bf',
          fontWeight: '600',
        }}>
          TOP 10
        </Text>
      </View>

      {/* Table */}
      <View>
        {rankings.map((team, idx) => (
          <View
            key={team.teamAbbrev?.default || team.teamAbbrev || idx}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: idx < rankings.length - 1 ? 1 : 0,
              borderBottomColor: '#192e5e44',
            }}
          >
            {/* Rank */}
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: idx < 3 ? '#f59e0b33' : '#192e5e44',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '800',
                color: idx < 3 ? '#f59e0b' : '#e6eef8',
              }}>
                {idx + 1}
              </Text>
            </View>

            {/* Team */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '700',
                color: '#e6eef8',
              }}>
                {team.teamAbbrev?.default || team.teamAbbrev}
              </Text>
              <Text style={{
                fontSize: 11,
                color: '#98a6bf',
                marginTop: 1,
              }}>
                {team.wins}-{team.losses}-{team.otLosses || 0}
              </Text>
            </View>

            {/* Points */}
            <Text style={{
              fontSize: 14,
              fontWeight: '700',
              color: '#e6eef8',
              marginRight: 12,
            }}>
              {team.points}
            </Text>

            {/* Trend */}
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: `${getTrendColor(team.trend)}22`,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12 }}>
                {getTrendIcon(team.trend)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <Text style={{
        fontSize: 10,
        color: '#98a6bf',
        textAlign: 'center',
        marginTop: 10,
        opacity: 0.8,
      }}>
        Based on points + recent form + goal differential
      </Text>
    </View>
  );
}
