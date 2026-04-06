import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { rinkGlass, theme } from '../../constants/theme';

interface StartSitPlayer {
  id: number;
  name: string;
  team: string;
  opponent: string;
  projectedPoints: number;
  recommendation: 'START' | 'SIT';
  hasDisagreement?: boolean;
  disagreementReason?: string;
}

interface StartSitModuleProps {
  players: StartSitPlayer[];
  onDismiss?: (id: number) => void;
  onPin?: (id: number) => void;
}

const SWIPE_THRESHOLD = 100;
const HINT_THRESHOLD = 40;

function PlayerCard({
  player,
  index,
  isPinned,
  onDismissCard,
  onPinCard,
}: {
  player: StartSitPlayer;
  index: number;
  isPinned: boolean;
  onDismissCard: (id: number) => void;
  onPinCard: (id: number) => void;
}) {
  const [decision, setDecision] = useState<'START' | 'SIT'>(player.recommendation);
  const [isRemoving, setIsRemoving] = useState(false);
  const isStart = decision === 'START';

  const toggleBgColor = useSharedValue(isStart ? rinkGlass.faceoffDot : rinkGlass.textMuted);

  // Disagreement pulse animation
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (player.hasDisagreement) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 750, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: player.hasDisagreement ? rinkGlass.powerPlay : rinkGlass.glassBorder,
    borderWidth: player.hasDisagreement ? 2 : 1,
    opacity: player.hasDisagreement ? pulseOpacity.value : 1,
  }));

  // Color wash sweep overlay
  const sweepX = useSharedValue(-160);

  // Swipe animation values (reanimated shared values)
  const swipeX = useSharedValue(0);
  const cardOpacityVal = useSharedValue(1);
  const cardScaleVal = useSharedValue(1);

  const handleToggle = () => {
    const newDecision = decision === 'START' ? 'SIT' : 'START';
    setDecision(newDecision);
    toggleBgColor.value = withTiming(
      newDecision === 'START' ? rinkGlass.faceoffDot : rinkGlass.textMuted
    );

    // Trigger color wash sweep
    sweepX.value = -160;
    sweepX.value = withTiming(160, { duration: 300 });

    // Haptic feedback on toggle
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const animatedToggleStyle = useAnimatedStyle(() => ({
    backgroundColor: toggleBgColor.value,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepX.value }],
    backgroundColor: decision === 'START' ? rinkGlass.faceoffDot : rinkGlass.textMuted,
  }));

  const handleDismiss = useCallback(() => {
    if (isRemoving) return;
    setIsRemoving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeX.value = withTiming(-200, { duration: 200 });
    cardOpacityVal.value = withTiming(0, { duration: 200 });
    setTimeout(() => onDismissCard(player.id), 220);
  }, [player.id, isRemoving, onDismissCard]);

  const handlePin = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeX.value = withSpring(0, { damping: 15, stiffness: 150 });
    cardScaleVal.value = withSequence(
      withTiming(1.05, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );
    onPinCard(player.id);
  }, [player.id, onPinCard]);

  // Refs to avoid stale closures in PanResponder
  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;
  const handlePinRef = useRef(handlePin);
  handlePinRef.current = handlePin;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gs: PanResponderGestureState) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_e, gs: PanResponderGestureState) => {
        swipeX.value = gs.dx;
      },
      onPanResponderRelease: (_e, gs: PanResponderGestureState) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          handleDismissRef.current();
        } else if (gs.dx > SWIPE_THRESHOLD) {
          handlePinRef.current();
        } else {
          swipeX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      },
    })
  ).current;

  // Animated styles for swipe hints and card
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      swipeX.value,
      [-SWIPE_THRESHOLD, -HINT_THRESHOLD, 0],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    ),
  }));

  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      swipeX.value,
      [0, HINT_THRESHOLD, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    ),
  }));

  const cardSwipeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipeX.value },
      { scale: cardScaleVal.value },
    ],
    opacity: cardOpacityVal.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify().damping(theme.animation.spring.damping).stiffness(theme.animation.spring.stiffness)}
    >
      <View style={styles.cardWrapper}>
        {/* Left-swipe hint (dismiss) */}
        <Animated.View
          style={[
            styles.hintOverlay,
            leftHintStyle,
            { backgroundColor: 'rgba(230, 57, 70, 0.25)' },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="close-circle" size={28} color={rinkGlass.redLine} />
        </Animated.View>

        {/* Right-swipe hint (pin) */}
        <Animated.View
          style={[
            styles.hintOverlay,
            rightHintStyle,
            { backgroundColor: 'rgba(76, 201, 240, 0.25)' },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="pin" size={28} color={rinkGlass.blueLight} />
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            isPinned && styles.pinnedHighlight,
            pulseStyle,
            cardSwipeStyle,
          ]}
        >
          {/* Color wash sweep overlay */}
          <Animated.View style={[styles.sweepOverlay, sweepStyle]} pointerEvents="none" />

          {/* Pin badge */}
          {isPinned && (
            <View style={styles.pinBadge}>
              <Ionicons name="pin" size={12} color={rinkGlass.blueLight} />
            </View>
          )}

          {/* Player icon placeholder */}
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={28} color={rinkGlass.textSecondary} />
          </View>

          {/* Player info */}
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.teamLabel}>{player.team}</Text>
          <Text style={styles.opponentLabel}>vs {player.opponent}</Text>

          {/* Projected points */}
          <Text style={styles.projectedPoints}>{player.projectedPoints}</Text>
          <Text style={styles.projLabel}>proj pts</Text>

          {/* Disagreement reason */}
          {player.hasDisagreement && (
            <Text style={styles.disagreementText}>
              {player.disagreementReason}
            </Text>
          )}

          {/* Toggle button */}
          <TouchableOpacity
            testID={`toggle-${player.id}`}
            onPress={handleToggle}
            activeOpacity={0.7}
          >
            <Animated.View style={[styles.toggleButton, animatedToggleStyle]}>
              <Text style={styles.toggleText}>{decision}</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function StartSitModule({ players, onDismiss, onPin }: StartSitModuleProps) {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  const handleDismiss = useCallback(
    (id: number) => {
      setDismissedIds((prev) => [...prev, id]);
      onDismiss?.(id);
    },
    [onDismiss]
  );

  const handlePin = useCallback(
    (id: number) => {
      setPinnedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      onPin?.(id);
    },
    [onPin]
  );

  const visiblePlayers = players.filter((p) => !dismissedIds.includes(p.id));
  // Sort pinned players to front
  const sortedPlayers = [
    ...visiblePlayers.filter((p) => pinnedIds.includes(p.id)),
    ...visiblePlayers.filter((p) => !pinnedIds.includes(p.id)),
  ];

  if (players.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.startSit }]} />
          <Text style={styles.title}>Start / Sit</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="moon-outline" size={32} color={rinkGlass.textMuted} />
          <Text style={styles.emptyText}>No players playing tonight</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.startSit }]} />
        <Text style={styles.title}>Start / Sit</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedPlayers.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            index={index}
            isPinned={pinnedIds.includes(player.id)}
            onDismissCard={handleDismiss}
            onPinCard={handlePin}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  accentStripe: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  title: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardWrapper: {
    position: 'relative',
    width: 160,
  },
  hintOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 16,
    padding: 16,
    width: 160,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  pinnedHighlight: {
    borderColor: 'rgba(76, 201, 240, 0.5)',
    shadowColor: rinkGlass.blueLight,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  pinBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  sweepOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: '100%',
    opacity: 0.3,
    borderRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: rinkGlass.glassHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  teamLabel: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  opponentLabel: {
    fontSize: 12,
    color: rinkGlass.textMuted,
    marginBottom: 10,
  },
  projectedPoints: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 32,
    color: rinkGlass.textPrimary,
    lineHeight: 36,
  },
  projLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  disagreementText: {
    fontSize: 11,
    color: rinkGlass.powerPlay,
    fontStyle: 'italic' as const,
    marginTop: 4,
    textAlign: 'center' as const,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  toggleButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.ice,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: rinkGlass.textMuted,
  },
});
