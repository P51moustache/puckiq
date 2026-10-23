/**
 * "Pro is on": the welcome after a trial or subscription starts (concept A,
 * docs/design/trial-welcome/concept-a.png). It shows the first move Pro unlocked tonight and turns
 * on game-night reminders in one tap. hooks/useTrialWelcome decides when; the frame is PromptSheet.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { FantasyPlayer } from '../../types/fantasy';
import type { CoachMove } from '../../services/fantasy/coach';
import { movePlayers, type MoveCall } from '../../services/engagement/trialWelcome';
import { reminderLeadLabel } from '../../services/engagement/reminderPrompt';
import { ART } from '../../constants/art';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { colors, display, IconButton, PrimaryButton } from '../coach/ui';
import { PromptSheet } from './PromptSheet';

/** Room kept above the sheet on short phones, so the status bar and a sliver of Tonight show. */
const TOP_CLEARANCE = 120;
/** PromptSheet's side padding. */
const SHEET_PADDING = 20;

interface TrialWelcomeSheetProps {
  visible: boolean;
  move: CoachMove | null;
  byId: Map<number, FantasyPlayer>;
  trialLine: string | null;
  notificationsOn: boolean;
  minutesBefore: number;
  onAccept: () => Promise<void>;
  onDismiss: () => void;
}

export function TrialWelcomeSheet({ visible, move, byId, trialLine, notificationsOn, minutesBefore, onAccept, onDismiss }: TrialWelcomeSheetProps) {
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  const accept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };
  return (
    <PromptSheet visible={visible} onDismiss={onDismiss} dismissLabel="Not now" testID="trial-welcome" backdropTestID="trial-welcome-backdrop">
      <ScrollView style={[styles.scroll, { maxHeight: height - TOP_CLEARANCE }]} contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={ART.rink} style={styles.rink} contentFit="cover" accessible={false} />
          <LinearGradient colors={[`${colors.raised}00`, colors.raised]} style={styles.rinkFade} pointerEvents="none" />
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">PRO IS ON</Text>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={26} color={colors.bg} />
            </View>
          </View>
          <Text style={styles.lede}>Your edge starts tonight.</Text>
          <View style={styles.close}>
            <IconButton icon="close" label="Close" onPress={onDismiss} compact testID="trial-welcome-close" />
          </View>
        </View>
        {move ? <FirstMoveCard move={move} byId={byId} /> : <UnlockedCard />}
        {notificationsOn ? null : (
          <View style={[styles.card, styles.bellCard]} testID="trial-welcome-reminders">
            <Ionicons name="notifications-outline" size={28} color={colors.text} />
            <View style={styles.flex}>
              <Text style={styles.bellTitle}>Never miss lock</Text>
              <Text style={styles.bellLine}>Reminder {reminderLeadLabel(minutesBefore)} before first puck</Text>
              <Text style={styles.bellLine}>Goal & scratch alerts for your players</Text>
            </View>
          </View>
        )}
        <PrimaryButton
          label={notificationsOn ? 'Let’s go' : 'Turn on reminders'}
          onPress={accept}
          loading={busy}
          testID="trial-welcome-accept"
        />
        {notificationsOn ? null : (
          <Pressable onPress={onDismiss} style={styles.later} accessibilityRole="button" testID="trial-welcome-later">
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        )}
        {trialLine ? <Text style={styles.fine} testID="trial-welcome-terms">{trialLine}</Text> : null}
      </ScrollView>
    </PromptSheet>
  );
}

function FirstMoveCard({ move, byId }: { move: CoachMove; byId: Map<number, FantasyPlayer> }) {
  const rows = movePlayers(move);
  return (
    <View style={styles.card} testID="trial-welcome-move">
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>YOUR FIRST PRO MOVE</Text>
        <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
      </View>
      {rows.length > 0 ? rows.map(({ playerId, call }) => {
        const player = byId.get(playerId);
        return (
          <View key={playerId} style={styles.playerRow}>
            <PlayerAvatar playerId={playerId} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={40} />
            <View style={styles.flex}>
              <Text style={styles.playerName} numberOfLines={1}>{player?.playerName ?? 'Player'}</Text>
              {player ? <Text style={styles.playerMeta} numberOfLines={1}>{player.teamAbbrev} · {player.position}</Text> : null}
            </View>
            <CallBadge call={call} />
          </View>
        );
      }) : <Text style={styles.moveTitle}>{move.title}</Text>}
      <View style={styles.rule} />
      <Text style={styles.moveDetail} numberOfLines={3}>{move.detail}</Text>
    </View>
  );
}

/** The call on one player, sized to read at a glance like the lineup's start/sit tags. */
function CallBadge({ call }: { call: MoveCall }) {
  const color = call.tone === 'bad' ? colors.bad : colors.warn;
  return (
    <View style={[styles.call, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.callText, { color }]}>{call.label}</Text>
    </View>
  );
}

/** A night where free users already saw every move: say what Pro covers from here on. */
function UnlockedCard() {
  return (
    <View style={styles.card} testID="trial-welcome-unlocked">
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>EVERY MOVE, EVERY NIGHT</Text>
        <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
      </View>
      <Text style={[styles.moveDetail, styles.unlocked]}>Your best lineup, every coach move and pickups for your empty slots, before each lock.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  // Full sheet width, so the rink hero can bleed to the edges; the content keeps the sheet's padding.
  scroll: { marginHorizontal: -SHEET_PADDING },
  body: { gap: 14, paddingBottom: 4, paddingHorizontal: SHEET_PADDING },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 22, marginHorizontal: -SHEET_PADDING, overflow: 'hidden' },
  rink: { ...StyleSheet.absoluteFillObject, opacity: 0.18 },
  rinkFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  title: { ...display(48), fontWeight: '900', letterSpacing: -1.4, lineHeight: 52, flexShrink: 1 },
  check: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.good, alignItems: 'center', justifyContent: 'center' },
  lede: { marginTop: 6, fontSize: 18, color: colors.sub },
  close: { position: 'absolute', top: 0, right: 16 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: colors.track, backgroundColor: colors.card, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.2, color: colors.text },
  proTag: { borderWidth: 1, borderColor: colors.good, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  proTagText: { fontSize: 11, fontWeight: '800', color: colors.good, letterSpacing: 0.5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.track },
  playerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  playerMeta: { marginTop: 2, fontSize: 13, color: colors.sub },
  call: { minWidth: 72, alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  callText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
  moveTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.track },
  moveDetail: { fontSize: 14, lineHeight: 20, color: colors.sub },
  unlocked: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.good },
  bellCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  bellLine: { fontSize: 14, lineHeight: 20, color: colors.sub },
  later: { alignItems: 'center', paddingVertical: 2 },
  laterText: { fontSize: 15, fontWeight: '600', color: colors.sub },
  fine: { textAlign: 'center', fontSize: 12, lineHeight: 17, color: colors.muted },
});
