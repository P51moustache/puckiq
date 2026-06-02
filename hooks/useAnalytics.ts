import { useCallback, useEffect, useRef } from 'react';
import AnalyticsService from '../services/analytics/AnalyticsService';
import { UserProperties } from '../services/analytics/types';

export function useAnalytics(screenName?: string) {
  const analytics = useRef(AnalyticsService.getInstance());
  const previousScreen = useRef<string | undefined>(undefined);

  // Track screen view when component mounts
  useEffect(() => {
    if (screenName) {
      analytics.current.trackScreenView(screenName, previousScreen.current);
      previousScreen.current = screenName;
    }
  }, [screenName]);

  // Note: the app-wide session listener lives in AnalyticsProvider (mounted once).
  // It used to be registered here, which duplicated session_start/session_end
  // once per mounted screen. Screen-view tracking above stays per-hook.

  // Tracking methods
  const trackUserAction = useCallback((
    action: string, 
    category: string, 
    label?: string, 
    value?: number, 
    properties?: Record<string, any>
  ) => {
    analytics.current.trackUserAction(action, category, label, value, properties);
  }, []);

  const trackFeatureUsage = useCallback((
    featureName: string,
    category: string,
    interactionType: 'click' | 'view' | 'complete' | 'share' | 'search',
    properties?: Record<string, any>
  ) => {
    analytics.current.trackFeatureUsage(featureName, category, interactionType, properties);
  }, []);

  const trackPerformance = useCallback((
    metricName: string,
    metricValue: number,
    unit: 'ms' | 'bytes' | 'count',
    properties?: Record<string, any>
  ) => {
    analytics.current.trackPerformance(metricName, metricValue, unit, properties);
  }, []);

  const trackError = useCallback((
    errorType: 'javascript' | 'network' | 'user_input' | 'system',
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    stack?: string
  ) => {
    analytics.current.trackError(errorType, message, severity, stack);
  }, []);

  const trackCustomEvent = useCallback((
    eventName: string,
    properties?: Record<string, any>
  ) => {
    analytics.current.trackCustomEvent(eventName, properties);
  }, []);

  const setUserId = useCallback((userId: string) => {
    analytics.current.setUserId(userId);
  }, []);

  const setUserProperties = useCallback((properties: UserProperties) => {
    analytics.current.setUserProperties(properties);
  }, []);

  return {
    trackUserAction,
    trackFeatureUsage,
    trackPerformance,
    trackError,
    trackCustomEvent,
    setUserId,
    setUserProperties,
  };
}

// Hook for tracking specific user interactions
export function useTrackUserInteraction(screenName: string) {
  const {
    trackUserAction,
    trackFeatureUsage,
  } = useAnalytics(screenName);

  const trackButtonPress = useCallback((buttonName: string, properties?: Record<string, any>) => {
    trackUserAction('button_press', 'ui_interaction', buttonName, undefined, {
      screen: screenName,
      ...properties,
    });
  }, [screenName, trackUserAction]);

  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    trackFeatureUsage('search', 'user_input', 'search', {
      query,
      results_count: resultsCount,
      screen: screenName,
    });
  }, [screenName, trackFeatureUsage]);

  const trackShare = useCallback((contentType: string, method?: string) => {
    trackFeatureUsage('share', 'social', 'share', {
      content_type: contentType,
      share_method: method,
      screen: screenName,
    });
  }, [screenName, trackFeatureUsage]);

  const trackTeamSelection = useCallback((teamName: string, teamAbbrev: string) => {
    trackUserAction('team_selected', 'user_preference', teamName, undefined, {
      team_abbrev: teamAbbrev,
      screen: screenName,
    });
  }, [screenName, trackUserAction]);

  const trackImageView = useCallback((imageIndex: number, imageSource: string) => {
    trackFeatureUsage('image_view', 'content', 'view', {
      image_index: imageIndex,
      image_source: imageSource,
      screen: screenName,
    });
  }, [screenName, trackFeatureUsage]);

  return {
    trackButtonPress,
    trackSearch,
    trackShare,
    trackTeamSelection,
    trackImageView,
  };
}