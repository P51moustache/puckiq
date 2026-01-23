import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { ThemeBanner } from '../../components/ThemeBanner';
import { FactorLeaderboard } from '../../components/FactorLeaderboard';
import { getCurrentTheme } from '../../services/weeklyTheme';
import { IconSymbol } from '../../components/ui/IconSymbol';

// Coach's Corner lesson categories
const LESSON_CATEGORIES = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description: 'Core hockey concepts every fan should know',
    icon: 'book.fill',
    lessons: 4,
  },
  {
    id: 'goaltending',
    title: 'Goaltending',
    description: 'Understanding the art of stopping pucks',
    icon: 'shield.fill',
    lessons: 4,
  },
  {
    id: 'advanced',
    title: 'Advanced Analytics',
    description: 'xG, Corsi, Fenwick, and beyond',
    icon: 'chart.bar.fill',
    lessons: 4,
  },
  {
    id: 'coaching',
    title: 'Coaching Concepts',
    description: 'Systems, matchups, and strategy',
    icon: 'person.3.fill',
    lessons: 4,
  },
];

export default function LearnScreen() {
  const router = useRouter();
  const weeklyTheme = getCurrentTheme();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <Text style={styles.subtitle}>Become a hockey expert</Text>
      </View>

      {/* Weekly Theme */}
      <View style={styles.section}>
        <ThemeBanner
          theme={weeklyTheme}
          onLearnMore={() => console.log('Navigate to theme lesson')}
        />
      </View>

      {/* Factor Leaderboard */}
      <View style={styles.section}>
        <FactorLeaderboard />
      </View>

      {/* Coach's Corner */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coach's Corner</Text>
        <Text style={styles.sectionSubtitle}>
          Bite-sized lessons to level up your hockey IQ
        </Text>

        <View style={styles.lessonGrid}>
          {LESSON_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.lessonCard}
              onPress={() => console.log('Navigate to', category.id)}
            >
              <View style={styles.lessonIcon}>
                <IconSymbol name={category.icon as any} size={24} color={theme.accent} />
              </View>
              <Text style={styles.lessonTitle}>{category.title}</Text>
              <Text style={styles.lessonDescription}>{category.description}</Text>
              <Text style={styles.lessonCount}>{category.lessons} lessons</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Teams & Players Link */}
      <TouchableOpacity
        style={styles.teamsLink}
        onPress={() => router.push('/explore')}
      >
        <View style={styles.teamsLinkContent}>
          <IconSymbol name="hockey.puck.fill" size={20} color={theme.accent} />
          <View style={styles.teamsLinkText}>
            <Text style={styles.teamsLinkTitle}>Teams & Players</Text>
            <Text style={styles.teamsLinkSubtitle}>Browse stats and analytics</Text>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={16} color={theme.subtext} />
      </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 16,
  },
  lessonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  lessonCard: {
    width: '48%',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
  },
  lessonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  lessonDescription: {
    fontSize: 12,
    color: theme.subtext,
    lineHeight: 16,
    marginBottom: 8,
  },
  lessonCount: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: '600',
  },
  teamsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  teamsLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamsLinkText: {
    gap: 2,
  },
  teamsLinkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  teamsLinkSubtitle: {
    fontSize: 12,
    color: theme.subtext,
  },
});
