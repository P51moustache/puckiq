import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../constants/theme';
import { BreakdownCard } from '../../components/BreakdownCard';
import { ResultsCard } from '../../components/ResultsCard';
import { ThemeBanner } from '../../components/ThemeBanner';
import { getCurrentTheme } from '../../services/weeklyTheme';
import { GameFactor } from '../../types/factors';

// Sample data for BreakdownCard preview
const sampleFactors: GameFactor[] = [
  {
    type: 'GOALIE_EDGE',
    advantage: 'CAR',
    description: 'GOALIE EDGE',
    detail: 'Andersen .932 vs Mrazek .891',
    impact: 41,
  },
  {
    type: 'HOME_ICE',
    advantage: 'CAR',
    description: 'HOME ICE',
    detail: '15-3-1 at home',
    impact: 30,
  },
  {
    type: 'REST',
    advantage: 'EVEN',
    description: 'REST',
    detail: 'Both teams 2 days rest',
    impact: 0,
  },
];

// Sample data for ResultsCard preview
const sampleResultFactors = [
  {
    type: 'GOALIE_EDGE' as const,
    advantage: 'CAR',
    description: 'GOALIE EDGE',
    detail: 'Andersen: 31 saves, .939',
    impact: 41,
    mattered: true,
    resultNote: 'This was the difference.',
  },
  {
    type: 'HOME_ICE' as const,
    advantage: 'CAR',
    description: 'HOME ICE',
    detail: 'CAR scored 2 in the 1st',
    impact: 30,
    mattered: true,
    resultNote: 'Home crowd energy paid off.',
  },
  {
    type: 'REST' as const,
    advantage: 'EVEN',
    description: 'REST',
    detail: 'CHI actually outshot CAR',
    impact: 0,
    mattered: false,
    resultNote: "Fatigue wasn't a factor.",
  },
];

export default function LearnScreen() {
  const weeklyTheme = getCurrentTheme();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Learn</Text>
      <Text style={styles.subtitle}>Component Previews</Text>

      <Text style={styles.sectionHeader}>ThemeBanner</Text>
      <ThemeBanner
        theme={weeklyTheme}
        onLearnMore={() => console.log('Learn more pressed')}
      />

      <Text style={styles.sectionHeader}>BreakdownCard (Pre-game)</Text>
      <BreakdownCard
        awayTeam="CHI"
        homeTeam="CAR"
        gameTime="7:00 PM"
        weeklyTheme="Goaltending"
        factors={sampleFactors}
        onPickTeam={(team) => console.log('Picked:', team)}
      />

      <Text style={styles.sectionHeader}>ResultsCard (Post-game)</Text>
      <ResultsCard
        awayTeam="CHI"
        homeTeam="CAR"
        awayScore={2}
        homeScore={4}
        userPick="CAR"
        factors={sampleResultFactors}
        insight="Goaltending and home ice were real. Rest was noise tonight."
      />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 12,
    marginTop: 8,
  },
});
