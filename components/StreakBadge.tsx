import React from 'react';
import { Text, View } from 'react-native';
import { insiderTheme } from '../constants/theme';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;

  // Determine streak intensity for visual effects
  const isHot = currentStreak >= 7;
  const isOnFire = currentStreak >= 14;
  const isLegendary = currentStreak >= 30;

  // Get fire emoji based on streak length
  const getFireEmoji = () => {
    if (isLegendary) return '👑🔥';
    if (isOnFire) return '🔥🔥';
    if (isHot) return '🔥';
    return '🔥';
  };

  // Get streak title based on length
  const getStreakTitle = () => {
    if (isLegendary) return 'LEGENDARY';
    if (isOnFire) return 'ON FIRE';
    if (isHot) return 'HOT STREAK';
    return 'STREAK';
  };

  // Dynamic colors based on streak intensity
  const streakColor = isLegendary ? insiderTheme.engagement.gold :
                      isOnFire ? insiderTheme.engagement.fire :
                      insiderTheme.engagement.streak;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${streakColor}22`,
      borderWidth: isHot ? 2 : 1.5,
      borderColor: `${streakColor}${isHot ? 'aa' : '66'}`,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    }}>
      <Text style={{ fontSize: isOnFire ? 18 : 16 }}>{getFireEmoji()}</Text>
      <View>
        <Text style={{
          fontSize: 10,
          fontWeight: '800',
          color: streakColor,
          letterSpacing: 0.5,
          marginBottom: 1,
        }}>
          {getStreakTitle()}
        </Text>
        <Text style={{
          fontSize: 13,
          fontWeight: '800',
          color: streakColor,
        }}>
          {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
        </Text>
        {longestStreak > currentStreak && (
          <Text style={{
            fontSize: 9,
            color: `${streakColor}99`,
            fontWeight: '600',
          }}>
            Best: {longestStreak}
          </Text>
        )}
      </View>
    </View>
  );
}
