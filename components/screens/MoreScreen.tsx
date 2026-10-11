import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import PageHeader from '../PageHeader';
import TeamSwitcher from '../coach/TeamSwitcher';
import { HockeyHero } from '../coach/HockeyHero';
import { Card, colors, contentFrame } from '../coach/ui';

const DESTINATIONS = [
  {
    route: '/week',
    title: 'Week planner',
    detail: 'Usable games, off-nights and matchup edge',
    icon: 'calendar-outline',
  },
  {
    route: '/pickups',
    title: 'Pickup finder',
    detail: 'Fill the empty slots in your lineup',
    icon: 'add-circle-outline',
  },
  {
    route: '/league',
    title: 'League Room',
    detail: 'League-mates, standings and trade ideas',
    icon: 'trophy-outline',
  },
  {
    route: '/settings',
    title: 'Settings & account',
    detail: 'League rules, reminders and PuckIQ Pro',
    icon: 'settings-outline',
  },
] as const;
export default function MoreScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <PageHeader compact title="More" accessory={<TeamSwitcher compact />} />
      <ScrollView contentContainerStyle={[styles.content, contentFrame]}>
        <View style={{ gap: 10 }}>
          {DESTINATIONS.map((item) => (
            <Card
              key={item.route}
              onPress={() => router.push(item.route as Href)}
              style={styles.row}
            >
              <Ionicons name={item.icon} size={22} color={colors.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.detail}>{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Card>
          ))}
        </View>
        <HockeyHero compact />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, lineHeight: 18, color: colors.sub },
});
