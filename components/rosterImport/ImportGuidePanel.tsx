/**
 * The import sheet's first screen when the team's league app can be opened (concept B, "one button
 * at a time", docs/design/import-guide/concept-b.png). Most people who tapped "Choose screenshots"
 * had no roster screenshot yet and cancelled, so the sheet leads with opening the league app, then
 * greets them on the way back. The panel is the body; the footer holds the buttons.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImportGuide } from '../../services/rosterImport/importGuide';
import { colors, DarkCard, display, GhostButton, PrimaryButton } from '../coach/ui';
import { RosterSketch } from './RosterSketch';

interface PanelProps {
  guide: ImportGuide;
  /** "Yahoo" */
  hostName: string;
  onOpenHost: () => void;
}

export function ImportGuidePanel({ guide, hostName, onOpenHost }: PanelProps) {
  const back = guide === 'returned';
  return (
    <>
      <DarkCard texture style={styles.hero} testID={`roster-import-guide-${guide}`}>
        <Text style={styles.heroTitle}>{back ? 'WELCOME BACK' : `START IN ${hostName.toUpperCase()}`}</Text>
        <Text style={styles.heroBody}>
          {back ? 'Pick the 2–3 screenshots you just took.' : 'Open your team and take 2–3 screenshots to capture your whole roster.'}
        </Text>
        {back ? null : <RosterSketch />}
      </DarkCard>
      {guide === 'no_screenshots' ? (
        <View style={styles.nudge} testID="roster-import-no-screenshots">
          <View style={styles.nudgeRow}>
            <Ionicons name="warning" size={20} color={colors.warn} />
            <View style={styles.flex}>
              <Text style={styles.nudgeTitle}>Nothing selected?</Text>
              <Text style={styles.nudgeBody}>Take your roster screenshots in {hostName}, then come back.</Text>
            </View>
          </View>
          <GhostButton label={`Open ${hostName} again`} icon="open-outline" tone="neutral" onPress={onOpenHost} testID="roster-import-open-host-again" />
        </View>
      ) : null}
    </>
  );
}

interface FooterProps extends PanelProps {
  onScan: () => void;
  onPaste: () => void;
}

/** One main button per moment: open the league app first, then choose the screenshots. */
export function ImportGuideFooter({ guide, hostName, onOpenHost, onScan, onPaste }: FooterProps) {
  const ready = guide === 'returned' || guide === 'no_screenshots';
  return (
    <>
      {ready ? (
        <PrimaryButton label="Choose screenshots" icon="images-outline" onPress={onScan} testID="roster-import-scan" />
      ) : (
        <>
          <PrimaryButton label={`Open ${hostName} to screenshot your roster`} icon="open-outline" onPress={onOpenHost} testID="roster-import-open-host" />
          <GhostButton label="I already have screenshots" icon="images-outline" tone="neutral" onPress={onScan} testID="roster-import-scan" />
        </>
      )}
      <Pressable onPress={onPaste} style={styles.link} accessibilityRole="button" testID="roster-import-paste">
        <Text style={styles.linkText}>Paste or type names instead</Text>
      </Pressable>
      {ready ? null : <Text style={styles.fine}>Read on your phone. Nothing uploaded.</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 10, padding: 18 },
  heroTitle: { ...display(30), color: colors.onInk, lineHeight: 34 },
  heroBody: { fontSize: 15, lineHeight: 21, color: colors.onInkSub },
  nudge: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(241, 185, 82, 0.45)',
    backgroundColor: 'rgba(241, 185, 82, 0.06)',
  },
  nudgeRow: { flexDirection: 'row', gap: 10 },
  nudgeTitle: { fontSize: 16, fontWeight: '800', color: colors.warn },
  nudgeBody: { fontSize: 14, lineHeight: 20, color: colors.sub },
  link: { alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.sub, textDecorationLine: 'underline' },
  fine: { textAlign: 'center', fontSize: 12, color: colors.muted },
});
