import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../constants/theme';
import { IconSymbol } from '../../components/ui/IconSymbol';

// Mock data - would come from pick tracking service
const USER_STATS = {
  overallAccuracy: 64,
  totalPicks: 247,
  currentStreak: 5,
  longestStreak: 11,
  bestWeek: { theme: 'Goaltending', accuracy: 82 },
  lessonsCompleted: 12,
  totalLessons: 24,
};

const FACTOR_ACCURACY = [
  { name: 'Goaltending', accuracy: 73, picks: 45 },
  { name: 'Home Ice', accuracy: 66, picks: 89 },
  { name: 'Recent Form', accuracy: 61, picks: 52 },
  { name: 'Special Teams', accuracy: 55, picks: 34 },
  { name: 'Rest Advantage', accuracy: 49, picks: 41 },
  { name: 'Divisional', accuracy: 51, picks: 28 },
];

export default function MyIQScreen() {
  const strengths = FACTOR_ACCURACY.filter(f => f.accuracy >= 60).slice(0, 3);
  const weaknesses = FACTOR_ACCURACY.filter(f => f.accuracy < 55).slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Hockey IQ</Text>
        <Text style={styles.subtitle}>Track your progress</Text>
      </View>

      {/* Overall Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{USER_STATS.overallAccuracy}%</Text>
          <Text style={styles.mainStatLabel}>Overall Accuracy</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.secondaryStats}>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{USER_STATS.totalPicks}</Text>
            <Text style={styles.secondaryStatLabel}>Picks</Text>
          </View>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{USER_STATS.currentStreak}</Text>
            <Text style={styles.secondaryStatLabel}>Streak</Text>
          </View>
        </View>
      </View>

      {/* Strengths */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="checkmark.circle.fill" size={18} color="#22c55e" />
          <Text style={styles.sectionTitle}>Your Strengths</Text>
        </View>
        <View style={styles.factorList}>
          {strengths.map((factor) => (
            <View key={factor.name} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <View style={styles.factorStats}>
                <Text style={[styles.factorAccuracy, { color: '#22c55e' }]}>
                  {factor.accuracy}%
                </Text>
                <Text style={styles.factorPicks}>{factor.picks} picks</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Room to Grow */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="arrow.up.circle.fill" size={18} color="#f59e0b" />
          <Text style={styles.sectionTitle}>Room to Grow</Text>
        </View>
        <View style={styles.factorList}>
          {weaknesses.map((factor) => (
            <View key={factor.name} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <View style={styles.factorStats}>
                <Text style={[styles.factorAccuracy, { color: '#f59e0b' }]}>
                  {factor.accuracy}%
                </Text>
                <Text style={styles.factorPicks}>{factor.picks} picks</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.growthTip}>
          This week focuses on Head-to-Head History. Practice makes perfect!
        </Text>
      </View>

      {/* Milestones */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="trophy.fill" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>Milestones</Text>
        </View>
        <View style={styles.milestoneGrid}>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>{USER_STATS.longestStreak}</Text>
            <Text style={styles.milestoneLabel}>Longest Streak</Text>
          </View>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>{USER_STATS.bestWeek.accuracy}%</Text>
            <Text style={styles.milestoneLabel}>Best Week</Text>
            <Text style={styles.milestoneDetail}>{USER_STATS.bestWeek.theme}</Text>
          </View>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>
              {USER_STATS.lessonsCompleted}/{USER_STATS.totalLessons}
            </Text>
            <Text style={styles.milestoneLabel}>Lessons</Text>
          </View>
        </View>
      </View>

      {/* Encouragement */}
      <View style={styles.encouragement}>
        <Text style={styles.encouragementText}>
          You're beating the average hockey fan. Keep learning!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.accent,
  },
  mainStatLabel: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 60,
    backgroundColor: theme.subtle,
    marginHorizontal: 20,
  },
  secondaryStats: {
    flex: 1,
    gap: 16,
  },
  secondaryStat: {
    alignItems: 'center',
  },
  secondaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  factorList: {
    gap: 12,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    fontSize: 14,
    color: theme.text,
  },
  factorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorAccuracy: {
    fontSize: 16,
    fontWeight: '700',
  },
  factorPicks: {
    fontSize: 12,
    color: theme.subtext,
    width: 55,
  },
  growthTip: {
    fontSize: 13,
    color: theme.subtext,
    fontStyle: 'italic',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
  },
  milestoneGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  milestoneCard: {
    flex: 1,
    backgroundColor: theme.subtle,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  milestoneValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  milestoneLabel: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 4,
  },
  milestoneDetail: {
    fontSize: 10,
    color: theme.accent,
    marginTop: 2,
  },
  encouragement: {
    backgroundColor: theme.subtle,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  encouragementText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
  },
});
