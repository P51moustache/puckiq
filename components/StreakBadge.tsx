import React from 'react';
import { Text, View } from 'react-native';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f59e0b22',
      borderWidth: 1.5,
      borderColor: '#f59e0b66',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    }}>
      <Text style={{ fontSize: 16 }}>🔥</Text>
      <View>
        <Text style={{
          fontSize: 13,
          fontWeight: '800',
          color: '#f59e0b',
        }}>
          {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
        </Text>
        {longestStreak > currentStreak && (
          <Text style={{
            fontSize: 9,
            color: '#f59e0b99',
            fontWeight: '600',
          }}>
            Best: {longestStreak}
          </Text>
        )}
      </View>
    </View>
  );
}
