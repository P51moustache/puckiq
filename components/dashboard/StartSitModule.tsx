import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

  // Color wash sweep overlay
  const sweepX = useSharedValue(-160);

  // Swipe animation values (horizontal: left=dismiss, right=pin)
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const cardOpacity = useRef(new RNAnimated.Value(1)).current;
  const cardScale = useRef(new RNAnimated.Value(1)).current;

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
    // Slide left and fade out
    RNAnimated.parallel([
      RNAnimated.timing(translateX, {
        toValue: -200,
        duration: 200,
        useNativeDriver: false,
      }),
      RNAnimated.timing(cardOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      onDismissCard(player.id);
    });
  }, [player.id, isRemoving, onDismissCard, translateX, cardOpacity]);

  const handlePin = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Snap back then pulse
    RNAnimated.sequence([
      RNAnimated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
        friction: 6,
      }),
      RNAnimated.sequence([
        RNAnimated.timing(cardScale, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: false,
        }),
        RNAnimated.timing(cardScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      onPinCard(player.id);
    });
  }, [player.id, onPinCard, translateX, cardScale]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gestureState: PanResponderGestureState) =>
        Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
      onPanResponderMove: (_e, gestureState: PanResponderGestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_e, gestureState: PanResponderGestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swiped left — dismiss
          handleDismiss();
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swiped right — pin
          handlePin();
        } else {
          // Snap back
          RNAnimated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            friction: 6,
          }).start();
        }
      },
    })
  ).current;

  // Interpolate action hint indicators
  const leftHintOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -HINT_THRESHOLD, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const rightHintOpacity = translateX.interpolate({
    inputRange: [0, HINT_THRESHOLD, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify().damping(theme.animation.spring.damping).stiffness(theme.animation.spring.stiffness)}
    >
      <View style={styles.cardWrapper}>
        {/* Left-swipe hint (dismiss) */}
        <RNAnimated.View
          style={[
            styles.hintOverlay,
            { opacity: leftHintOpacity, backgroundColor: 'rgba(230, 57, 70, 0.25)' },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="close-circle" size={28} color={rinkGlass.redLine} />
        </RNAnimated.View>

        {/* Right-swipe hint (pin) */}
        <RNAnimated.View
          style={[
            styles.hintOverlay,
            { opacity: rightHintOpacity, backgroundColor: 'rgba(76, 201, 240, 0.25)' },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="pin" size={28} color={rinkGlass.blueLight} />
        </RNAnimated.View>

        <RNAnimated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            isPinned && styles.pinnedHighlight,
            {
              transform: [{ translateX }, { scale: cardScale }],
              opacity: cardOpacity,
            },
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
        </RNAnimated.View>
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
