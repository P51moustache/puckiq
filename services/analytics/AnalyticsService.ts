import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent as webLogEvent, setUserId as webSetUserId, setUserProperties as webSetUserProperties } from 'firebase/analytics';
import { Platform } from 'react-native';
import { analytics as webAnalytics } from '../../lib/firebase';
import {
    AnalyticsConfig,
    AnalyticsEvent,
    CustomEvent,
    ErrorEvent,
    FeatureUsageEvent,
    PerformanceEvent,
    ScreenViewEvent,
    UserActionEvent,
    UserProperties
} from './types';

class AnalyticsService {
  private static instance: AnalyticsService;
  private config: AnalyticsConfig;
  private sessionId: string;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private lastActivityTime: number = Date.now();
  private initialized: boolean = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      enabled: true,
      debug: __DEV__,
      sessionTimeout: 30, // 30 minutes
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
    };
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async initialize(config?: Partial<AnalyticsConfig>): Promise<void> {
    if (this.initialized) {
      return; // Already initialized, skip
    }

    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Load saved config from storage
      const savedConfig = await AsyncStorage.getItem('analytics_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsed };
      }

      // Load saved user ID
      const savedUserId = await AsyncStorage.getItem('analytics_user_id');
      if (savedUserId) {
        this.config.userId = savedUserId;
        this.setUserId(savedUserId);
      }

      // Start flush timer
      this.startFlushTimer();

      this.initialized = true;
      this.log('Analytics service initialized');
    } catch (error) {
      console.error('Failed to initialize analytics service:', error);
    }
  }

  // Session management
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateActivity(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    // Update timestamp FIRST to prevent recursion
    this.lastActivityTime = now;

    // If more than session timeout, create new session
    if (timeSinceLastActivity > this.config.sessionTimeout * 60 * 1000) {
      this.sessionId = this.generateSessionId();
      this.trackSessionStart();
    }
  }

  // User management
  async setUserId(userId: string): Promise<void> {
    this.config.userId = userId;
    await AsyncStorage.setItem('analytics_user_id', userId);

    // Set user ID in Firebase Analytics (web only for now)
    if (Platform.OS === 'web' && webAnalytics) {
      webSetUserId(webAnalytics, userId);
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    try {
      await AsyncStorage.setItem('analytics_user_properties', JSON.stringify(properties));

      // Set user properties in Firebase Analytics (web only for now)
      if (Platform.OS === 'web' && webAnalytics) {
        webSetUserProperties(webAnalytics, properties);
      }

      this.log('User properties set:', properties);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  // Event tracking methods
  trackScreenView(screenName: string, previousScreen?: string): void {
    this.updateActivity();
    
    const event: ScreenViewEvent = {
      event: 'screen_view',
      screen_name: screenName,
      screen_class: screenName,
      previous_screen: previousScreen,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  trackUserAction(action: string, category: string, label?: string, value?: number, properties?: Record<string, any>): void {
    this.updateActivity();
    
    const event: UserActionEvent = {
      event: 'user_action',
      action,
      category,
      label,
      value,
      properties,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  trackFeatureUsage(featureName: string, category: string, interactionType: 'click' | 'view' | 'complete' | 'share' | 'search', properties?: Record<string, any>): void {
    this.updateActivity();
    
    const event: FeatureUsageEvent = {
      event: 'feature_usage',
      feature_name: featureName,
      feature_category: category,
      interaction_type: interactionType,
      properties,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  trackPerformance(metricName: string, metricValue: number, unit: 'ms' | 'bytes' | 'count', properties?: Record<string, any>): void {
    const event: PerformanceEvent = {
      event: 'performance',
      metric_name: metricName,
      metric_value: metricValue,
      metric_unit: unit,
      properties,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  trackError(errorType: 'javascript' | 'network' | 'user_input' | 'system', message: string, severity: 'low' | 'medium' | 'high' | 'critical', stack?: string): void {
    const event: ErrorEvent = {
      event: 'error',
      error_type: errorType,
      error_message: message,
      error_stack: stack,
      severity,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  trackCustomEvent(eventName: string, properties?: Record<string, any>): void {
    this.updateActivity();
    
    const event: CustomEvent = {
      event: eventName,
      properties,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.config.userId,
    };

    this.addToQueue(event);
  }

  // Session events
  trackSessionStart(): void {
    this.trackCustomEvent('session_start', {
      platform: Platform.OS,
      app_version: '1.0.0', // You can get this from app.json
    });
  }

  trackSessionEnd(): void {
    this.trackCustomEvent('session_end', {
      session_duration: Date.now() - this.lastActivityTime,
    });
    this.flush(); // Ensure events are sent before session ends
  }

  // Queue management
  private addToQueue(event: AnalyticsEvent): void {
    if (!this.config.enabled) return;

    this.eventQueue.push(event);
    this.log('Event added to queue:', event);

    // Auto-flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to Firebase Analytics (web only for now)
      if (Platform.OS === 'web' && webAnalytics) {
        for (const event of eventsToFlush) {
          const { timestamp, session_id, user_id, event: eventName, ...properties } = event;
          webLogEvent(webAnalytics, eventName, {
            timestamp,
            session_id,
            user_id,
            ...properties,
          });
        }
      }

      // Always persist locally for debugging/offline analysis
      await this.persistEvents(eventsToFlush);

      this.log(`Flushed ${eventsToFlush.length} events`);
    } catch (error) {
      // Re-add events to queue if flush failed
      this.eventQueue.unshift(...eventsToFlush);
      console.error('Failed to flush analytics events:', error);
    }
  }

  private async persistEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const existingEvents = await AsyncStorage.getItem('analytics_events');
      const allEvents = existingEvents ? JSON.parse(existingEvents) : [];
      const updatedEvents = [...allEvents, ...events];
      
      // Keep only recent events (last 1000)
      const recentEvents = updatedEvents.slice(-1000);
      
      await AsyncStorage.setItem('analytics_events', JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to persist analytics events:', error);
    }
  }

  // Debug and utility methods
  async getStoredEvents(): Promise<AnalyticsEvent[]> {
    try {
      const events = await AsyncStorage.getItem('analytics_events');
      return events ? JSON.parse(events) : [];
    } catch (error) {
      console.error('Failed to get stored events:', error);
      return [];
    }
  }

  async clearStoredEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem('analytics_events');
      this.log('Stored events cleared');
    } catch (error) {
      console.error('Failed to clear stored events:', error);
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    AsyncStorage.setItem('analytics_config', JSON.stringify(this.config));
  }

  setDebug(debug: boolean): void {
    this.config.debug = debug;
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Analytics] ${message}`, data || '');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

export default AnalyticsService;