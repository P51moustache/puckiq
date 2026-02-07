import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  // Get streak icon based on streak length
  const getStreakIcon = (): { name: keyof typeof Ionicons.glyphMap; size: number } => {
    if (isLegendary) return { name: 'trophy', size: 18 };
    if (isOnFire) return { name: 'flame', size: 18 };
    return { name: 'flame-outline', size: 16 };
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
      <Ionicons name={getStreakIcon().name} size={getStreakIcon().size} color={streakColor} />
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
