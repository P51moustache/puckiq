import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { rinkGlass, theme } from '../../constants/theme';
import {
  FantasyAlert,
  AlertType,
  getAlertColor,
  dismissAlert,
  saveAlert,
} from '../../services/fantasyAlerts';

interface AlertsModuleProps {
  alerts: FantasyAlert[];
  onDismiss?: (id: string) => void;
  onSave?: (id: string) => void;
}

function getAlertIcon(type: AlertType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'injury':
      return 'alert-circle';
    case 'goalie':
      return 'shield-checkmark';
    case 'lineup':
      return 'swap-horizontal';
  }
}

const SWIPE_THRESHOLD = 100;
const HINT_THRESHOLD = 40;

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return timestamp; // fallback for non-ISO strings
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface SwipeableAlertCardProps {
  alert: FantasyAlert;
  index: number;
  onDismissCard: (id: string) => void;
  onSaveCard: (id: string) => void;
}

function SwipeableAlertCard({
  alert,
  index,
  onDismissCard,
  onSaveCard,
}: SwipeableAlertCardProps) {
  const swipeX = useSharedValue(0);
  const savedOpacityVal = useSharedValue(0);
  const collapseHeight = useSharedValue(500); // large default, set onLayout
  const collapseMargin = useSharedValue(8);
  const [isSaved, setIsSaved] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const color = getAlertColor(alert.type);
  const measuredHeight = useRef(0);

  const handleDismiss = useCallback(() => {
    if (isRemoving) return;
    setIsRemoving(true);
    dismissAlert(alert.id);
    swipeX.value = withTiming(400, { duration: 200 });
    setTimeout(() => {
      collapseHeight.value = withTiming(0, { duration: 200 });
      collapseMargin.value = withTiming(0, { duration: 200 });
      setTimeout(() => onDismissCard(alert.id), 220);
    }, 220);
  }, [alert.id, onDismissCard, isRemoving]);

  const handleSave = useCallback(() => {
    saveAlert(alert.id);
    setIsSaved(true);
    swipeX.value = withSpring(0, { damping: 15, stiffness: 150 });
    savedOpacityVal.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 600 })
    );
    setTimeout(() => {
      setIsSaved(false);
      onSaveCard(alert.id);
    }, 800);
  }, [alert.id, onSaveCard]);

  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gs: PanResponderGestureState) =>
        Math.abs(gs.dx) > 10,
      onPanResponderMove: (_e, gs: PanResponderGestureState) => {
        swipeX.value = gs.dx;
      },
      onPanResponderRelease: (_e, gs: PanResponderGestureState) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          handleDismissRef.current();
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          handleSaveRef.current();
        } else {
          swipeX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      },
    })
  ).current;

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [0, HINT_THRESHOLD, SWIPE_THRESHOLD], [0, 0.6, 1], Extrapolation.CLAMP),
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [-SWIPE_THRESHOLD, -HINT_THRESHOLD, 0], [1, 0.6, 0], Extrapolation.CLAMP),
  }));

  const cardSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: collapseHeight.value,
    marginBottom: collapseMargin.value,
    overflow: 'hidden' as const,
  }));

  const savedOverlayStyle = useAnimatedStyle(() => ({
    opacity: savedOpacityVal.value,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify().damping(theme.animation.spring.damping).stiffness(theme.animation.spring.stiffness)}
    >
      <Animated.View
        style={collapseStyle}
        onLayout={(e) => {
          if (measuredHeight.current === 0) {
            const h = e.nativeEvent.layout.height;
            measuredHeight.current = h;
            collapseHeight.value = h;
          }
        }}
      >
        <View style={styles.swipeContainer}>
          {/* Right-swipe action background (dismiss) */}
          <Animated.View
            style={[
              styles.actionBackground,
              styles.actionLeft,
              rightActionStyle,
              { backgroundColor: rinkGlass.faceoffDot },
            ]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.actionLabel}>Dismiss</Text>
          </Animated.View>

          {/* Left-swipe action background (save) */}
          <Animated.View
            style={[
              styles.actionBackground,
              styles.actionRight,
              leftActionStyle,
              { backgroundColor: rinkGlass.blueLight },
            ]}
          >
            <Text style={styles.actionLabel}>Save</Text>
            <Ionicons name="bookmark" size={20} color="#fff" />
          </Animated.View>

          {/* Swipeable card */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              alert.isRosterPlayer && styles.rosterHighlight,
              cardSwipeStyle,
            ]}
            testID={`alert-card-${alert.id}`}
          >
            <View style={[styles.stripe, { backgroundColor: color }]} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name={getAlertIcon(alert.type)}
                  size={16}
                  color={color}
                  testID={`alert-icon-${alert.type}`}
                />
                <Text style={styles.playerName}>{alert.playerName}</Text>
                <Text style={styles.teamAbbrev}>{alert.team}</Text>
              </View>
              <Text style={styles.message}>{alert.message}</Text>
              <Text style={styles.timestamp}>{formatRelativeTime(alert.timestamp)}</Text>
            </View>

            {/* Saved overlay */}
            {isSaved && (
              <Animated.View style={[styles.savedOverlay, savedOverlayStyle]}>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.savedText}>Saved!</Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function AlertsModule({ alerts, onDismiss, onSave }: AlertsModuleProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissedIds((prev) => [...prev, id]);
      onDismiss?.(id);
    },
    [onDismiss]
  );

  const handleSave = useCallback(
    (id: string) => {
      onSave?.(id);
    },
    [onSave]
  );

  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  return (
    <View style={styles.container}>
      {/* Module header */}
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.powerPlay }]} />
        <Text style={styles.headerTitle}>Alerts</Text>
      </View>

      {visibleAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={32} color={rinkGlass.textSecondary} />
          <Text style={styles.emptyText}>No alerts right now</Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {visibleAlerts.map((alert, index) => (
            <SwipeableAlertCard
              key={alert.id}
              alert={alert}
              index={index}
              onDismissCard={handleDismiss}
              onSaveCard={handleSave}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accentStripe: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: rinkGlass.textSecondary,
    fontSize: 14,
  },
  timeline: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  swipeContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 10,
  },
  actionLeft: {
    justifyContent: 'flex-start',
  },
  actionRight: {
    justifyContent: 'flex-end',
  },
  actionLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  rosterHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(76, 201, 240, 0.3)',
    shadowColor: rinkGlass.blueLight,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  stripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  teamAbbrev: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginLeft: 'auto',
  },
  message: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 11,
    color: rinkGlass.textSecondary,
    opacity: 0.6,
    marginTop: 4,
  },
  savedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(76, 201, 240, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: 10,
  },
  savedText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
