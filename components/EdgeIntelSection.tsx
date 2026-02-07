import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type {
  EdgeSkaterLanding,
  EdgeTeamLanding,
  EdgeByTheNumbers,
} from '../types/edgeStats';

interface EdgeIntelSectionProps {
  skaterLanding: EdgeSkaterLanding | null;
  teamLanding: EdgeTeamLanding | null;
  byTheNumbers: EdgeByTheNumbers | null;
}

interface IntelCard {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  subtitle: string;
}

function buildCards(
  skaterLanding: EdgeSkaterLanding | null,
  teamLanding: EdgeTeamLanding | null,
  byTheNumbers: EdgeByTheNumbers | null
): IntelCard[] {
  const cards: IntelCard[] = [];

  // Shot Speed card
  if (skaterLanding?.hardestShot) {
    const speed = skaterLanding.hardestShot.shotSpeed?.imperial?.speed;
    const name = skaterLanding.hardestShot.player?.lastName?.default;
    if (speed && name) {
      cards.push({
        key: 'shot-speed',
        icon: 'flash',
        title: 'SHOT SPEED',
        value: `${speed.toFixed(0)} mph`,
        subtitle: name,
      });
    }
  }

  // Skating Speed card
  if (skaterLanding?.maxSkatingSpeed) {
    const speed = skaterLanding.maxSkatingSpeed.skatingSpeed?.imperial?.speed;
    const name = skaterLanding.maxSkatingSpeed.player?.lastName?.default;
    if (speed && name) {
      cards.push({
        key: 'skating-speed',
        icon: 'speedometer-outline',
        title: 'SKATING SPEED',
        value: `${speed.toFixed(1)} mph`,
        subtitle: name,
      });
    }
  }

  // Zone Time card (team leader)
  if (teamLanding?.shotAttemptsOver90) {
    const team = teamLanding.shotAttemptsOver90.team?.abbrev;
    const value = teamLanding.shotAttemptsOver90.value;
    if (team && value) {
      cards.push({
        key: 'zone-time',
        icon: 'disc-outline',
        title: 'SHOTS >90mph',
        value: `${value}`,
        subtitle: `#1 ${team}`,
      });
    }
  }

  // Distance / Speed Bursts
  if (teamLanding?.burstsOver22) {
    const team = teamLanding.burstsOver22.team?.abbrev;
    const value = teamLanding.burstsOver22.value;
    if (team && value) {
      cards.push({
        key: 'shot-map',
        icon: 'pulse-outline',
        title: 'SPEED BURSTS',
        value: `${value}`,
        subtitle: `#1 ${team}`,
      });
    }
  }

  return cards.slice(0, 4);
}

export default function EdgeIntelSection({
  skaterLanding,
  teamLanding,
  byTheNumbers,
}: EdgeIntelSectionProps) {
  const cards = buildCards(skaterLanding, teamLanding, byTheNumbers);

  if (cards.length === 0) return null;

  return (
    <Animated.View
      testID="edge-intel-section"
      entering={FadeInUp.duration(400)}
      style={styles.container}
    >
      <Text style={styles.header}>EDGE INTEL</Text>
      <View style={styles.grid}>
        {cards.map((card, index) => (
          <Animated.View
            key={card.key}
            entering={FadeInUp.springify().damping(18).stiffness(120).delay(100 + index * 80)}
          >
            <View testID={`edge-intel-card-${card.key}`} style={styles.card}>
              <Ionicons name={card.icon} size={20} color={theme.accent} />
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: 160,
    height: 120,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.08)',
    justifyContent: 'space-between',
  },
  cardIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginTop: 4,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
  },
});
