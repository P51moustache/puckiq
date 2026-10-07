/**
 * "How PuckIQ decides" — the honest fine print, one tap away instead of grey footnotes
 * under every card. Each screen opens its own topic with an ⓘ button.
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, display } from '../coach/ui';

export type HowItWorksTopic = 'tonight' | 'week' | 'pickups' | 'league';

interface Section {
  title: string;
  lines: string[];
}

export const HOW_IT_WORKS: Record<HowItWorksTopic, { title: string; sections: Section[] }> = {
  tonight: {
    title: 'Tonight',
    sections: [
      {
        title: 'Who plays and who’s out',
        lines: [
          'Scratches come from the NHL game report — the only confirmed signal. Injury news is matched to your players and labelled “likely”.',
          'The NHL doesn’t announce starting goalies before puck drop, so we don’t either. We show how often each goalie has started instead.',
        ],
      },
      {
        title: 'Your night',
        lines: [
          'The night runs until 6 AM Eastern, so a late West Coast game stays on Tonight until it ends.',
          'Live points use your league’s scoring on the box score. Box scores don’t list power-play assists, so live PPP counts power-play goals only.',
          'Hindsight shows how much of the best possible lineup — knowing the results — PuckIQ’s pre-game lineup captured.',
        ],
      },
      {
        title: 'Your league',
        lines: ['Make changes in Yahoo, ESPN, or Fantrax. PuckIQ never logs in to or touches your league.'],
      },
    ],
  },
  week: {
    title: 'Week',
    sections: [
      {
        title: 'Games that count',
        lines: [
          'A game counts when your lineup has a slot for him that night. The best set of starters is solved for each day with your league’s positions.',
          'A hatched bar means he plays but your slots at his positions are already full — that game is lost to the bench.',
        ],
      },
      {
        title: 'Off-nights',
        lines: ['Off-nights have 7 or fewer NHL games. Fewer teams play, so streamers face less competition for your slots.'],
      },
      {
        title: 'Matchup',
        lines: [
          'Both sides use the same lineup rules and scoring, from today through Sunday.',
          'In a League Room, your opponent’s roster fills in from the room and stays current.',
        ],
      },
    ],
  },
  pickups: {
    title: 'Pickups',
    sections: [
      {
        title: 'How they’re ranked',
        lines: [
          'By what each player adds to YOUR lineup over the window you pick — only nights he would actually start for you, empty slots first.',
          'Value per game blends this season with last season early on, and weights the last 14 days.',
        ],
      },
      {
        title: 'Who we hide',
        lines: [
          'Players a league your size almost always rosters are hidden. Change your league size in League settings.',
          '“Mark taken” hides a player you see rostered in your league. In a League Room, your league-mates’ players are hidden automatically.',
        ],
      },
    ],
  },
  league: {
    title: 'League Room',
    sections: [
      {
        title: 'What the room shares',
        lines: [
          'Each member’s team name and roster, which your league already shows everyone. Your coach moves and pickups stay private.',
          'PuckIQ never logs in to your league and never moves money. Dues are a checklist only.',
        ],
      },
      {
        title: 'Keeping it friendly',
        lines: [
          'Reactions are a fixed set — there’s no chat. Any member can leave, the owner can remove a member, and anyone can report a room from the room’s ⋯ menu.',
        ],
      },
    ],
  },
};

export function HowItWorksSheet({
  topic,
  visible,
  onClose,
  extra = [],
}: {
  topic: HowItWorksTopic;
  visible: boolean;
  onClose: () => void;
  /** Screen-specific facts (e.g. "Using 2025-26 numbers until this season has games."). */
  extra?: string[];
}) {
  const content = HOW_IT_WORKS[topic];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID={`how-${topic}`}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>How PuckIQ decides</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" testID={`how-${topic}-done`} style={styles.headerSpacer}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{content.title.toUpperCase()}</Text>
          {extra.length > 0 ? (
            <View style={styles.extra}>
              {extra.map((line) => (
                <Text key={line} style={styles.extraLine}>{line}</Text>
              ))}
            </View>
          ) : null}
          {content.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.kickerRow}>
                <View style={styles.kickerDot} />
                <Text style={styles.kicker}>{section.title.toUpperCase()}</Text>
              </View>
              {section.lines.map((line) => (
                <Text key={line} style={styles.line}>{line}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** The ⓘ that opens a topic. Small enough to sit in a section label or a hero corner. */
export function HowItWorksButton({
  topic,
  extra,
  dark = false,
  testID,
}: {
  topic: HowItWorksTopic;
  extra?: string[];
  dark?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`How PuckIQ decides: ${HOW_IT_WORKS[topic].title}`}
        testID={testID ?? `how-${topic}-button`}
      >
        <Ionicons name="information-circle-outline" size={20} color={dark ? colors.onInkSub : colors.sub} />
      </Pressable>
      <HowItWorksSheet topic={topic} visible={open} onClose={() => setOpen(false)} extra={extra} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerSpacer: { minWidth: 52, alignItems: 'flex-end' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  done: { fontSize: 16, fontWeight: '800', color: colors.accent },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  title: { ...display(30), marginTop: 4, marginBottom: 16 },
  extra: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 6,
  },
  extraLine: { color: colors.onInk, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  section: { marginBottom: 20 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 8 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.text },
  line: { fontSize: 15, lineHeight: 22, color: colors.sub, marginBottom: 8 },
});
