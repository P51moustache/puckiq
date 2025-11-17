import React from 'react';
import { Text, View } from 'react-native';
import { determineWinner, formatStatValue } from '../services/teamComparison';

interface StatComparisonRowProps {
  awayValue: number;
  awayAbbrev: string;
  statLabel: string;
  homeValue: number;
  homeAbbrev: string;
  higherIsBetter: boolean;
  awayRank?: number;
  homeRank?: number;
  format?: 'number' | 'percentage' | 'decimal';
  decimals?: number;
  isFirst?: boolean;
}

export default function StatComparisonRow({
  awayValue,
  awayAbbrev,
  statLabel,
  homeValue,
  homeAbbrev,
  higherIsBetter,
  awayRank,
  homeRank,
  format = 'decimal',
  decimals = 1,
  isFirst = false,
}: StatComparisonRowProps) {
  const winner = determineWinner(homeValue, awayValue, higherIsBetter);

  const awayColor = winner === 'away' ? '#60a5fa' : '#e6eef8';
  const homeColor = winner === 'home' ? '#f59e0b' : '#e6eef8';
  const awayWeight = winner === 'away' ? '800' : '400';
  const homeWeight = winner === 'home' ? '800' : '400';

  const awayFormattedValue = formatStatValue(awayValue, format, decimals);
  const homeFormattedValue = formatStatValue(homeValue, format, decimals);

  const awayRankText = awayRank ? ` (${awayRank}${getOrdinalSuffix(awayRank)})` : '';
  const homeRankText = homeRank ? ` (${homeRank}${getOrdinalSuffix(homeRank)})` : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: '#192e5e44',
      }}
    >
      {/* Away Team Value */}
      <View style={{ width: 80, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 13, fontWeight: awayWeight as any, color: awayColor }}>
          {awayFormattedValue}
        </Text>
        {awayRank && (
          <Text style={{ fontSize: 9, color: '#98a6bf', marginTop: 2 }}>
            {awayRank}{getOrdinalSuffix(awayRank)}
          </Text>
        )}
      </View>

      {/* Stat Label */}
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
        <Text
          style={{
            fontSize: 11,
            color: '#98a6bf',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {statLabel}
        </Text>
      </View>

      {/* Home Team Value */}
      <View style={{ width: 80, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: homeWeight as any, color: homeColor }}>
          {homeFormattedValue}
        </Text>
        {homeRank && (
          <Text style={{ fontSize: 9, color: '#98a6bf', marginTop: 2 }}>
            {homeRank}{getOrdinalSuffix(homeRank)}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Helper function to get ordinal suffix for rankings (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;

  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}
