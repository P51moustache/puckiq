/**
 * Compact charcoal surfaces, restrained borders and red actions from the approved concept.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ART, ART_ASPECT } from '../../constants/art';
import { colors, display, pressedStyle, toneColor, type Tone } from './theme';
import { PrimaryButton } from './Buttons';

/** Ice blue for cold streaks — only used next to the frozen-puck art. */
const COLD = '#2F7FC1';

export { colors, display, toneColor, layout, typography, type Tone } from './theme';
export { SegmentedControl } from './SegmentedControl';

/**
 * iPad: at this width screens switch to two columns. iPad mini portrait is 744pt,
 * every other iPad is wider; phones top out around 440pt.
 */
export const WIDE_MIN_WIDTH = 700;
/** Content never gets wider than this, so landscape iPads stay readable. */
export const CONTENT_MAX_WIDTH = 1160;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN_WIDTH;
}

/** Centered, capped-width content column (spread into a contentContainerStyle). */
export const contentFrame: ViewStyle = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
};

/** Two columns side by side on iPad; stacked (left then right) on phones. */
export function Columns({
  left,
  right,
  style,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const wide = useWide();
  if (!wide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={[styles.columns, style]}>
      <View style={styles.column}>{left}</View>
      <View style={styles.column}>{right}</View>
    </View>
  );
}

export function SectionLabel({
  title,
  right,
  style,
  flush = false,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** No top margin — for a label that opens a column next to a card. */
  flush?: boolean;
}) {
  return (
    <View style={[styles.sectionRow, flush && styles.sectionFlush, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && pressedStyle, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

/** Carbon panel for the hero moments (countdown, lineup, matchup). */
export function DarkCard({
  children,
  style,
  testID,
  texture = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Faint rink lines behind the content, like the circuit maps on F1 race cards. */
  texture?: boolean;
}) {
  return (
    <View
      style={[styles.darkCard, texture && styles.textured, style]}
      testID={testID}
    >
      {texture ? (
        <Image
          source={ART.rink}
          style={styles.texture}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      {children}
    </View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
  solid = false,
  testID,
}: {
  label: string;
  tone?: Tone;
  solid?: boolean;
  testID?: string;
}) {
  const color = toneColor(tone);
  return (
    <View
      testID={testID}
      style={[
        styles.pill,
        solid ? { backgroundColor: color } : { backgroundColor: `${color}18` },
      ]}
    >
      <Text style={[styles.pillText, { color: solid ? '#FFFFFF' : color }]}>
        {label}
      </Text>
    </View>
  );
}

export function ProBadge({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.proBadge, small && styles.proBadgeSmall]}>
      <Text style={[styles.proBadgeText, small && styles.proBadgeTextSmall]}>
        PRO
      </Text>
      <View style={styles.proDot} />
    </View>
  );
}

export function ProLockCard({
  title,
  detail,
  cta = 'Unlock with Pro',
  onPress,
  testID,
}: {
  title: string;
  detail: string;
  cta?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Card
      onPress={onPress}
      style={styles.lockCard}
      testID={testID}
      accessibilityLabel={`${title}. ${cta}`}
    >
      <View style={styles.lockHeader}>
        <ProBadge />
        <Ionicons name="lock-closed" size={14} color={colors.muted} />
      </View>
      <Text style={styles.lockTitle}>{title}</Text>
      <Text style={styles.lockDetail}>{detail}</Text>
      <View style={styles.lockCta}>
        <Text style={styles.lockCtaText}>{cta}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.onInk} />
      </View>
    </Card>
  );
}

export { PrimaryButton, GhostButton, IconButton } from './Buttons';

export function EmptyState({
  icon,
  art,
  title,
  body,
  action,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Illustration from constants/art — shown instead of the icon. */
  art?: number;
  title: string;
  body: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID}>
      {art ? (
        <Image
          source={art}
          style={styles.emptyArt}
          contentFit="contain"
          accessible={false}
        />
      ) : icon ? (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={26} color={colors.text} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

/** Full-screen "couldn't load" state for when there's nothing cached to show. */
export function ErrorState({
  title = 'Couldn’t reach the NHL',
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      art={ART.error}
      title={title}
      body={body}
      action={
        <PrimaryButton
          label="Try again"
          icon="refresh"
          variant="black"
          onPress={onRetry}
          testID="error-retry"
        />
      }
      testID="error-state"
    />
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card style={styles.errorCard} testID="error-banner">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warn} />
      <Text style={styles.errorText} numberOfLines={2}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function StatCell({
  value,
  label,
  tone = 'neutral',
  testID,
  dark = false,
  size = 28,
}: {
  value: string;
  label: string;
  tone?: Tone;
  testID?: string;
  dark?: boolean;
  size?: number;
}) {
  const valueColor =
    tone !== 'neutral' ? toneColor(tone) : dark ? colors.onInk : colors.text;
  return (
    <View style={styles.statCell} testID={testID}>
      <Text style={[display(size), { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, dark && { color: colors.onInkSub }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** F1 "Team Lock Deadline" bar. `onDark` lifts it off a carbon panel; `urgent` turns it red. */
export function CountdownBar({
  label,
  value,
  testID,
  onDark = false,
  urgent = false,
  flag = false,
}: {
  label: string;
  value: string;
  testID?: string;
  onDark?: boolean;
  urgent?: boolean;
  /** Checkered flag beside the value — the night (or week) is done. */
  flag?: boolean;
}) {
  return (
    <View
      style={[
        styles.countdown,
        onDark && { backgroundColor: colors.inkRaised },
        urgent && { backgroundColor: colors.accent },
      ]}
      testID={testID}
    >
      <Text style={styles.countdownLabel}>{label}</Text>
      <View style={styles.countdownRight}>
        {flag ? (
          <Image
            source={ART.checkeredFlag}
            style={{ height: 26, width: 26 * ART_ASPECT.checkeredFlag }}
            contentFit="contain"
            accessible={false}
            testID="countdown-flag"
          />
        ) : null}
        <Text style={styles.countdownValue}>{value}</Text>
      </View>
    </View>
  );
}

/** The app-icon puck, for brand kickers ("PUCKIQ", "PUCKIQ PRO"). */
export function BrandMark({ height = 14 }: { height?: number }) {
  return (
    <Image
      source={ART.logoMark}
      style={{ height, width: height * ART_ASPECT.logoMark }}
      contentFit="contain"
      accessible={false}
      testID="brand-mark"
    />
  );
}

/** Cold-streak badge: puck frozen in ice + COLD. */
export function ColdBadge({ testID }: { testID?: string }) {
  return (
    <View
      style={[styles.hotBadge, styles.coldBadge]}
      testID={testID ?? 'cold-badge'}
      accessibilityLabel="Cold streak"
    >
      <Image
        source={ART.coldPuck}
        style={{ height: 16, width: 16 * ART_ASPECT.coldPuck }}
        contentFit="contain"
        accessible={false}
      />
      <Text style={[styles.hotText, styles.coldText]}>COLD</Text>
    </View>
  );
}

/** Hot-streak badge: flaming puck + HOT. */
export function HotBadge({ testID }: { testID?: string }) {
  return (
    <View
      style={styles.hotBadge}
      testID={testID ?? 'hot-badge'}
      accessibilityLabel="Hot streak"
    >
      <Image
        source={ART.hotPuck}
        style={{ height: 16, width: 16 * ART_ASPECT.hotPuck }}
        contentFit="contain"
        accessible={false}
      />
      <Text style={styles.hotText}>HOT</Text>
    </View>
  );
}

/** Pulsing placeholder block (RN Animated — keeps this kit free of reanimated). */
export function Skeleton({
  width,
  height,
  radius = 8,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.raised,
        opacity,
      }}
    />
  );
}

export function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.loadingRows} testID="loading-rows">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.loadingRow}>
          <Skeleton width={48} height={48} radius={12} />
          <View style={styles.loadingText}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  sectionFlush: {
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  darkCard: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    padding: 10,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  textured: {
    overflow: 'hidden',
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  proBadgeSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.onInk,
    letterSpacing: 0.6,
  },
  proBadgeTextSmall: {
    fontSize: 9,
  },
  proDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  lockCard: {
    gap: 6,
  },
  lockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  lockDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
  },
  lockCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  lockCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onInk,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 10,
  },
  countdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 4,
    paddingRight: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: `${colors.accent}14`,
  },
  coldBadge: {
    backgroundColor: `${COLD}14`,
  },
  coldText: {
    color: COLD,
  },
  hotText: {
    fontSize: 10,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.6,
    color: colors.accent,
  },
  emptyArt: {
    width: 240,
    height: 240,
    marginBottom: -8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    ...display(24),
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.sub,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 10,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.sub,
  },
  retry: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  statCell: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  countdownLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.onInk,
  },
  countdownValue: {
    ...display(22),
    color: colors.onInk,
  },
  loadingRows: {
    gap: 12,
    paddingVertical: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
  },
  loadingText: {
    flex: 1,
    gap: 8,
  },

});
