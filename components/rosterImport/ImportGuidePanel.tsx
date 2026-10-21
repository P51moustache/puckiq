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
import { colors, display, GhostButton, PrimaryButton } from '../coach/ui';
import { RosterPhones, RosterThumbs } from './RosterSketch';

interface PanelProps {
  guide: ImportGuide;
  /** "Yahoo" */
  hostName: string;
  onOpenHost: () => void;
}

export function ImportGuidePanel({ guide, hostName, onOpenHost }: PanelProps) {
  const back = guide === 'returned';
  const picking = back || guide === 'no_screenshots';
  return (
    <>
      <View style={styles.hero} testID={`roster-import-guide-${guide}`}>
        <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>{back ? 'WELCOME BACK' : `START IN ${hostName.toUpperCase()}`}</Text>
        <Text style={styles.heroBody}>{heroBody(guide)}</Text>
      </View>
      {picking ? <RosterThumbs host={hostName} /> : <RosterPhones host={hostName} />}
      {guide === 'no_screenshots' ? (
        <View style={styles.nudge} testID="roster-import-no-screenshots">
          <View style={styles.nudgeRow}>
            <Ionicons name="warning" size={20} color={colors.warn} />
            <View style={styles.flex}>
              <Text style={styles.nudgeTitle}>Nothing selected?</Text>
              <Text style={styles.nudgeBody}>Take your roster screenshots in {hostName}, then come back.</Text>
            </View>
          </View>
          <GhostButton label={`Open ${hostName} again`} tone="neutral" onPress={onOpenHost} testID="roster-import-open-host-again" />
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
        <PrimaryButton label="Choose screenshots" onPress={onScan} testID="roster-import-scan" />
      ) : (
        <>
          <PrimaryButton label={`Open ${hostName} to screenshot your roster`} onPress={onOpenHost} testID="roster-import-open-host" />
          <GhostButton label="I already have screenshots" tone="neutral" onPress={onScan} testID="roster-import-scan" />
        </>
      )}
      <Pressable onPress={onPaste} style={styles.link} accessibilityRole="button" testID="roster-import-paste">
        <Text style={styles.linkText}>Paste or type names instead</Text>
      </Pressable>
      {ready ? null : <Text style={styles.fine}>Read on your phone. Nothing uploaded.</Text>}
    </>
  );
}

function heroBody(guide: ImportGuide): string {
  if (guide === 'returned') return 'Pick the 2–3 screenshots you just took.';
  if (guide === 'no_screenshots') return 'Pick 2–3 screenshots of your roster screen, like these.';
  return 'Open your team and take 2–3 screenshots to capture your whole roster.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 8 },
  heroTitle: { ...display(44), fontWeight: '900', letterSpacing: -1.2, lineHeight: 48 },
  heroBody: { fontSize: 18, lineHeight: 24, color: colors.text },
  nudge: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(241, 185, 82, 0.45)',
    backgroundColor: 'rgba(241, 185, 82, 0.06)',
  },
  nudgeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  nudgeTitle: { fontSize: 16, fontWeight: '800', color: colors.warn },
  nudgeBody: { fontSize: 14, lineHeight: 20, color: colors.sub },
  link: { alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.sub, textDecorationLine: 'underline' },
  fine: { textAlign: 'center', fontSize: 12, color: colors.muted },
});
