import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnalyticsService from '../../services/analytics/AnalyticsService';
import { AnalyticsEvent } from '../../services/analytics/types';
import { theme } from '../../constants/theme';

interface AnalyticsDashboardProps {
  visible: boolean;
  onClose: () => void;
}

export default function AnalyticsDashboard({ visible, onClose }: AnalyticsDashboardProps) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const analytics = AnalyticsService.getInstance();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const storedEvents = await analytics.getStoredEvents();
      setEvents(storedEvents.slice(-50)); // Show last 50 events
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearEvents = async () => {
    Alert.alert(
      'Clear Events',
      'Are you sure you want to clear all stored analytics events?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await analytics.clearStoredEvents();
            setEvents([]);
          },
        },
      ]
    );
  };

  const formatEventData = (event: AnalyticsEvent) => {
    const { timestamp, session_id, user_id, event: eventName, ...properties } = event;
    return {
      time: new Date(timestamp).toLocaleTimeString(),
      eventName,
      properties: Object.keys(properties).length > 0 ? properties : null,
    };
  };

  const getEventColor = (eventName: string) => {
    switch (eventName) {
      case 'screen_view': return theme.semantic.positive;
      case 'user_action': return theme.accent;
      case 'feature_usage': return theme.semantic.neutral;
      case 'performance': return '#9C27B0';
      case 'error': return theme.semantic.negative;
      default: return theme.subtext;
    }
  };

  const getEventStats = () => {
    const stats = events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stats).map(([event, count]) => ({ event, count }));
  };

  useEffect(() => {
    if (visible) {
      loadEvents();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Analytics Dashboard</Text>
          <View style={styles.headerButtons}>
            <Pressable style={[styles.button, styles.clearButton]} onPress={clearEvents}>
              <Text style={styles.buttonText}>Clear</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.refreshButton]} onPress={loadEvents}>
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.closeButton]} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {/* Event Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Event Statistics</Text>
          <View style={styles.statsGrid}>
            {getEventStats().map(({ event, count }) => (
              <View key={event} style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: getEventColor(event) }]} />
                <Text style={styles.statText}>{event}: {count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Event List */}
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>Recent Events ({events.length})</Text>
          <ScrollView style={styles.eventsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={styles.loadingText}>Loading events...</Text>
            ) : events.length === 0 ? (
              <Text style={styles.emptyText}>No events tracked yet</Text>
            ) : (
              events.slice().reverse().map((event, index) => {
                const formattedEvent = formatEventData(event);
                return (
                  <View key={index} style={styles.eventItem}>
                    <View style={styles.eventHeader}>
                      <View style={[styles.eventDot, { backgroundColor: getEventColor(event.event) }]} />
                      <Text style={styles.eventName}>{formattedEvent.eventName}</Text>
                      <Text style={styles.eventTime}>{formattedEvent.time}</Text>
                    </View>
                    {formattedEvent.properties && (
                      <View style={styles.eventProperties}>
                        <Text style={styles.propertiesText}>
                          {JSON.stringify(formattedEvent.properties, null, 2)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: theme.semantic.negative,
  },
  refreshButton: {
    backgroundColor: theme.accent,
  },
  closeButton: {
    backgroundColor: theme.subtext,
  },
  buttonText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statText: {
    color: theme.subtext,
    fontSize: 12,
  },
  eventsContainer: {
    flex: 1,
    padding: 20,
  },
  eventsList: {
    flex: 1,
  },
  loadingText: {
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  eventItem: {
    backgroundColor: theme.card,
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventName: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  eventTime: {
    color: theme.subtext,
    fontSize: 12,
  },
  eventProperties: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  propertiesText: {
    color: theme.subtext,
    fontSize: 11,
    fontFamily: theme.fonts.mono,
  },
});