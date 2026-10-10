/**
 * One goalie's start outlook on a Tonight row: "B2B · BACKUP LIKELY" and the reason in words
 * for everyone, plus his start chance as a percent for Pro. An estimate — the NHL names
 * starters at puck drop — so it says "likely", never "confirmed".
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { outlookLabel, type GoalieOutlook, type StartOutlook } from '../../services/fantasy/goalieOutlook';
import { colors, display, Pill, type Tone } from '../coach/ui';

export interface GoalieOutlookTagProps {
  outlook: GoalieOutlook;
  /** Pro also sees his start chance as a percent. */
  isPro: boolean;
  /** Root testID; the parts add `-label`, `-chance` and `-reason`. */
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const TONE: Record<StartOutlook, Tone> = { likely: 'good', split: 'warn', unlikely: 'bad' };
const SPOKEN: Record<StartOutlook, string> = { likely: 'start likely', split: 'a toss-up', unlikely: 'backup likely' };

/** What VoiceOver reads: the call, the reason, and (Pro) the chance. */
export function outlookSentence(outlook: GoalieOutlook, isPro: boolean): string {
  const call = `Estimated start: ${outlook.backToBack ? 'back-to-back, ' : ''}${SPOKEN[outlook.outlook]}.`;
  const chance = isPro ? ` About ${percent(outlook)} chance he starts.` : '';
  return `${call} ${outlook.reason}.${chance}`;
}

function percent(outlook: GoalieOutlook): string {
  return `${Math.round(outlook.chance * 100)}%`;
}

export function GoalieOutlookTag({ outlook, isPro, testID = 'goalie-outlook', style }: GoalieOutlookTagProps) {
  return (
    <View style={[styles.tag, style]} testID={testID} accessible accessibilityLabel={outlookSentence(outlook, isPro)}>
      <View style={styles.head}>
        <Pill label={outlookLabel(outlook)} tone={TONE[outlook.outlook]} testID={`${testID}-label`} />
        {isPro ? (
          <View style={styles.chance} testID={`${testID}-chance`}>
            <Text style={styles.chanceValue}>{percent(outlook)}</Text>
            <Text style={styles.chanceLabel}>TO START</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.reason} testID={`${testID}-reason`}>{outlook.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    gap: 4,
    flexShrink: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  chanceValue: {
    ...display(14),
  },
  chanceLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  reason: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.sub,
  },
});
