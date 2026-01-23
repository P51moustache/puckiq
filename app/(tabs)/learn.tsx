import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../constants/theme';
import { BreakdownCard } from '../../components/BreakdownCard';
import { GameFactor } from '../../types/factors';

// Sample data for preview
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

export default function LearnScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Learn</Text>
      <Text style={styles.subtitle}>BreakdownCard Preview</Text>

      <View style={styles.previewSection}>
        <BreakdownCard
          awayTeam="CHI"
          homeTeam="CAR"
          gameTime="7:00 PM"
          weeklyTheme="Goaltending"
          factors={sampleFactors}
          onPickTeam={(team) => console.log('Picked:', team)}
        />
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
  previewSection: {
    marginTop: 16,
  },
});
