import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { rinkGlass } from '../../constants/theme';
import { FantasyAlert, AlertType, getAlertColor } from '../../services/fantasyAlerts';

interface AlertsModuleProps {
  alerts: FantasyAlert[];
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

export default function AlertsModule({ alerts }: AlertsModuleProps) {
  return (
    <View style={styles.container}>
      {/* Module header */}
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.powerPlay }]} />
        <Text style={styles.headerTitle}>Alerts</Text>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={32} color={rinkGlass.textSecondary} />
          <Text style={styles.emptyText}>No alerts right now</Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {alerts.map((alert, index) => {
            const color = getAlertColor(alert.type);
            return (
              <Animated.View
                key={alert.id}
                entering={FadeInDown.delay(index * 80).duration(300)}
                style={[
                  styles.card,
                  alert.isRosterPlayer && styles.rosterHighlight,
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
              </Animated.View>
            );
          })}
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
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  rosterHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(76, 201, 240, 0.3)', // blueLight glow
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
});
