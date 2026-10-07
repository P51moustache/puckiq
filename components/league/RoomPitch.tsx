/**
 * The League Room pitch: a carbon hero with one line on why to bring your league and the four
 * things a room does, numbered like a timing sheet. Shown before a room exists (and, with the
 * "almost here" strip, while League Rooms aren't switched on yet).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, CountdownBar, DarkCard, display } from '../coach/ui';
import { Kicker } from './Kicker';

export const ROOM_BENEFITS: readonly { title: string; detail: string }[] = [
  { title: 'Real availability', detail: 'Pickups hides every player your league-mates roster.' },
  { title: 'Automatic opponent', detail: 'Pick your matchup once. Week fills in their roster.' },
  { title: 'Game-night board', detail: 'Who plays, games that count and live points for the whole league.' },
  { title: 'Monday recap + dues', detail: 'Weekly awards to share, and a dues checklist.' },
];

export function RoomPitch({ comingSoon = false }: { comingSoon?: boolean }) {
  return (
    <DarkCard texture style={styles.hero} testID="room-pitch">
      <Kicker dark label="League Room" />
      <View>
        <Text style={styles.title}>BRING YOUR LEAGUE.</Text>
        <Text style={styles.lede}>Every league-mate who joins makes everyone’s coach smarter.</Text>
      </View>
      <View>
        {ROOM_BENEFITS.map((benefit, index) => (
          <View key={benefit.title} style={[styles.benefit, index > 0 && styles.divided]}>
            <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{benefit.title.toUpperCase()}</Text>
              <Text style={styles.benefitDetail}>{benefit.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      {comingSoon ? <CountdownBar onDark label="League Rooms are almost here" value="SOON" testID="room-coming-soon" /> : null}
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 16 },
  title: { ...display(34), color: colors.onInk, lineHeight: 38 },
  lede: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.onInk, marginTop: 6 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)' },
  number: { ...display(22), color: colors.accent, width: 38 },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, color: colors.onInk },
  benefitDetail: { fontSize: 14, lineHeight: 19, color: colors.onInkSub },
});
