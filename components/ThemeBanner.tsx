import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import { WeeklyTheme } from '../types/weeklyTheme';
import { IconSymbol } from './ui/IconSymbol';

interface ThemeBannerProps {
  theme: WeeklyTheme;
  onLearnMore?: () => void;
}

export function ThemeBanner({ theme: weeklyTheme, onLearnMore }: ThemeBannerProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'fundamental':
        return '#22c55e'; // green
      case 'intermediate':
        return '#f59e0b'; // amber
      case 'advanced':
        return '#ef4444'; // red
      default:
        return theme.accent;
    }
  };

  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.weekLabel}>THIS WEEK</Text>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(weeklyTheme.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(weeklyTheme.difficulty) }]}>
              {weeklyTheme.difficulty}
            </Text>
          </View>
        </View>
        <Text style={styles.themeName}>{weeklyTheme.name}</Text>
        <Text style={styles.themeDescription}>{weeklyTheme.description}</Text>
      </View>

      <View style={styles.lessonIntro}>
        <Text style={styles.lessonText}>{weeklyTheme.lessonIntro}</Text>
      </View>

      {onLearnMore && (
        <TouchableOpacity style={styles.learnMoreButton} onPress={onLearnMore}>
          <Text style={styles.learnMoreText}>Learn more about {weeklyTheme.name.toLowerCase()}</Text>
          <IconSymbol name="chevron.right" size={14} color={theme.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.accent,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
    letterSpacing: 1.5,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  themeName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 14,
    color: theme.subtext,
  },
  lessonIntro: {
    backgroundColor: theme.subtle,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  lessonText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  learnMoreText: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: '600',
  },
});
