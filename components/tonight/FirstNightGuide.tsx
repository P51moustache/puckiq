/**
 * The guided first night at the top of Tonight: three steps, each one tap that does the thing,
 * with progress like a lap counter. Disappears once all three are done or it's closed.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FIRST_NIGHT_STEPS, type FirstNightStep } from '../../services/engagement/firstNight';
import { Card, colors, IconButton } from '../coach/ui';
import { Kicker } from './Kicker';

interface StepCopy {
  title: string;
  detail: string;
}

export interface FirstNightGuideProps {
  done: readonly FirstNightStep[];
  /** None of my players play tonight: step one looks at the next night instead. */
  quietNight: boolean;
  onStep: (step: FirstNightStep) => void;
  onDismiss: () => void;
}

function copyFor(step: FirstNightStep, quietNight: boolean): StepCopy {
  switch (step) {
    case 'players':
      return quietNight
        ? { title: 'See who plays next', detail: 'Tonight’s quiet for your team — check the next night' }
        : { title: 'See who plays tonight', detail: 'Your players, their games and matchups' };
    case 'pickup':
      return { title: 'Find one pickup', detail: 'The best free agent for your week' };
    case 'reminder':
      return { title: 'Get a game-night reminder', detail: 'Before lock, and when your night goes live' };
  }
}

export function FirstNightGuide({ done, quietNight, onStep, onDismiss }: FirstNightGuideProps) {
  const next = FIRST_NIGHT_STEPS.find((step) => !done.includes(step));
  return (
    <Card style={styles.card} testID="tonight-first-night">
      <Kicker
        onInk={false}
        label={`YOUR FIRST NIGHT · ${done.length} OF ${FIRST_NIGHT_STEPS.length}`}
        right={<IconButton icon="close" label="Close the first-night guide" onPress={onDismiss} testID="first-night-close" />}
      />
      <View style={styles.laps}>
        {FIRST_NIGHT_STEPS.map((step) => (
          <View key={step} style={[styles.lap, done.includes(step) && styles.lapDone]} />
        ))}
      </View>
      {FIRST_NIGHT_STEPS.map((step, index) => {
        const finished = done.includes(step);
        const copy = copyFor(step, quietNight);
        return (
          <Pressable
            key={step}
            onPress={() => onStep(step)}
            disabled={finished}
            accessibilityRole="button"
            accessibilityState={{ disabled: finished, checked: finished }}
            accessibilityLabel={`${copy.title}. ${copy.detail}`}
            testID={`first-night-${step}`}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <View style={[styles.badge, finished && styles.badgeDone, step === next && styles.badgeNext]}>
              {finished ? (
                <Ionicons name="checkmark" size={16} color={colors.onAccent} />
              ) : (
                <Text style={[styles.badgeText, step === next && styles.badgeTextNext]}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, finished && styles.titleDone]}>{copy.title}</Text>
              <Text style={styles.detail}>{copy.detail}</Text>
            </View>
            {finished ? null : <Ionicons name="chevron-forward" size={18} color={step === next ? colors.accent : colors.muted} />}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, gap: 10 },
  laps: { flexDirection: 'row', gap: 6 },
  lap: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  lapDone: { backgroundColor: colors.accent },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  pressed: { opacity: 0.7 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  badgeNext: { backgroundColor: colors.ink },
  badgeDone: { backgroundColor: colors.accent },
  badgeText: { fontSize: 13, fontWeight: '900', color: colors.sub },
  badgeTextNext: { color: colors.onInk },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  detail: { fontSize: 13, lineHeight: 18, color: colors.sub },
});
