import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const cardHeight = useRef(new RNAnimated.Value(1)).current; // scale factor for height
  const savedOpacity = useRef(new RNAnimated.Value(0)).current;
  const [isSaved, setIsSaved] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const color = getAlertColor(alert.type);
  // Track measured height for collapse animation
  const measuredHeight = useRef(0);
  const animatedHeight = useRef(new RNAnimated.Value(0)).current;
  const marginBottom = useRef(new RNAnimated.Value(8)).current;

  const handleDismiss = useCallback(() => {
    if (isRemoving) return;
    setIsRemoving(true);
    dismissAlert(alert.id);
    // Slide out to right, then collapse height
    RNAnimated.sequence([
      RNAnimated.timing(translateX, {
        toValue: 400,
        duration: 200,
        useNativeDriver: false,
      }),
      RNAnimated.parallel([
        RNAnimated.timing(animatedHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        RNAnimated.timing(marginBottom, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      onDismissCard(alert.id);
    });
  }, [alert.id, onDismissCard, isRemoving, translateX, animatedHeight, marginBottom]);

  const handleSave = useCallback(() => {
    saveAlert(alert.id);
    setIsSaved(true);
    // Flash "Saved!" then spring back
    RNAnimated.parallel([
      RNAnimated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
        friction: 6,
      }),
      RNAnimated.sequence([
        RNAnimated.timing(savedOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        RNAnimated.timing(savedOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      setIsSaved(false);
      onSaveCard(alert.id);
    });
  }, [alert.id, onSaveCard, translateX, savedOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gestureState: PanResponderGestureState) =>
        Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_e, gestureState: PanResponderGestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_e, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swiped right — dismiss
          handleDismiss();
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swiped left — save
          handleSave();
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

  // Interpolate background indicators
  const rightActionOpacity = translateX.interpolate({
    inputRange: [0, HINT_THRESHOLD, SWIPE_THRESHOLD],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  const leftActionOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -HINT_THRESHOLD, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify().damping(theme.animation.spring.damping).stiffness(theme.animation.spring.stiffness)}
    >
      <RNAnimated.View
        style={{ height: animatedHeight, marginBottom, overflow: 'hidden' }}
        onLayout={(e) => {
          if (measuredHeight.current === 0) {
            const h = e.nativeEvent.layout.height;
            measuredHeight.current = h;
            animatedHeight.setValue(h);
          }
        }}
      >
        <View style={styles.swipeContainer}>
          {/* Right-swipe action background (dismiss) */}
          <RNAnimated.View
            style={[
              styles.actionBackground,
              styles.actionLeft,
              { opacity: rightActionOpacity, backgroundColor: rinkGlass.faceoffDot },
            ]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.actionLabel}>Dismiss</Text>
          </RNAnimated.View>

          {/* Left-swipe action background (save) */}
          <RNAnimated.View
            style={[
              styles.actionBackground,
              styles.actionRight,
              { opacity: leftActionOpacity, backgroundColor: rinkGlass.blueLight },
            ]}
          >
            <Text style={styles.actionLabel}>Save</Text>
            <Ionicons name="bookmark" size={20} color="#fff" />
          </RNAnimated.View>

          {/* Swipeable card */}
          <RNAnimated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              alert.isRosterPlayer && styles.rosterHighlight,
              { transform: [{ translateX }] },
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
              <Text style={styles.timestamp}>{alert.timestamp}</Text>
            </View>

            {/* Saved overlay */}
            {isSaved && (
              <RNAnimated.View style={[styles.savedOverlay, { opacity: savedOpacity }]}>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.savedText}>Saved!</Text>
              </RNAnimated.View>
            )}
          </RNAnimated.View>
        </View>
      </RNAnimated.View>
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
