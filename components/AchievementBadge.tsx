import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Achievement } from '../constants/achievements';

interface AchievementBadgeProps {
  achievement: Achievement & { unlocked: boolean; progress: number };
}

export default function AchievementBadge({ achievement }: AchievementBadgeProps) {
  return (
    <View style={[styles.container, !achievement.unlocked && styles.locked]}>
      {/* Icon */}
      <View style={[styles.iconContainer, !achievement.unlocked && styles.iconLocked]}>
        <Ionicons
          name={achievement.icon}
          size={28}
          color={achievement.unlocked ? '#60a5fa' : '#98a6bf'}
          style={!achievement.unlocked ? { opacity: 0.4 } : undefined}
        />
      </View>

      {/* Title and Description */}
      <View style={styles.textContainer}>
        <Text style={[styles.title, !achievement.unlocked && styles.titleLocked]} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text style={[styles.description, !achievement.unlocked && styles.descriptionLocked]} numberOfLines={2}>
          {achievement.description}
        </Text>

        {/* Progress Bar (only show for locked achievements) */}
        {!achievement.unlocked && achievement.progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${achievement.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(achievement.progress)}%</Text>
          </View>
        )}

        {/* Unlocked Badge */}
        {achievement.unlocked && (
          <View style={styles.unlockedBadge}>
            <Text style={styles.unlockedText}>✓ Unlocked</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    backgroundColor: '#192e5eff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  locked: {
    borderColor: '#192e5e88',
    opacity: 0.6,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#60a5fa22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  iconLocked: {
    backgroundColor: '#192e5e44',
  },
  textContainer: {
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e6eef8',
    textAlign: 'center',
  },
  titleLocked: {
    color: '#98a6bf',
  },
  description: {
    fontSize: 11,
    color: '#98a6bf',
    textAlign: 'center',
    lineHeight: 14,
  },
  descriptionLocked: {
    color: '#98a6bf88',
  },
  progressContainer: {
    marginTop: 8,
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#192e5e44',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#60a5fa',
  },
  progressText: {
    fontSize: 9,
    color: '#98a6bf',
    textAlign: 'center',
  },
  unlockedBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#10b98122',
    borderRadius: 6,
    alignSelf: 'center',
  },
  unlockedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
});
