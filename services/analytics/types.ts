// Analytics event types and interfaces
export interface BaseEvent {
  timestamp: number;
  session_id: string;
  user_id?: string;
}

export interface ScreenViewEvent extends BaseEvent {
  event: 'screen_view';
  screen_name: string;
  screen_class?: string;
  previous_screen?: string;
}

export interface UserActionEvent extends BaseEvent {
  event: 'user_action';
  action: string;
  category: string;
  label?: string;
  value?: number;
  properties?: Record<string, any>;
}

export interface FeatureUsageEvent extends BaseEvent {
  event: 'feature_usage';
  feature_name: string;
  feature_category: string;
  interaction_type: 'click' | 'view' | 'complete' | 'share' | 'search';
  properties?: Record<string, any>;
}

export interface PerformanceEvent extends BaseEvent {
  event: 'performance';
  metric_name: string;
  metric_value: number;
  metric_unit: 'ms' | 'bytes' | 'count';
  properties?: Record<string, any>;
}

export interface ErrorEvent extends BaseEvent {
  event: 'error';
  error_type: 'javascript' | 'network' | 'user_input' | 'system';
  error_message: string;
  error_stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CustomEvent extends BaseEvent {
  event: string;
  properties?: Record<string, any>;
}

export type AnalyticsEvent = 
  | ScreenViewEvent 
  | UserActionEvent 
  | FeatureUsageEvent 
  | PerformanceEvent 
  | ErrorEvent 
  | CustomEvent;

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  userId?: string;
  sessionTimeout: number; // in minutes
  batchSize: number;
  flushInterval: number; // in milliseconds
}

// User properties interface
export interface UserProperties {
  user_type?: 'free' | 'premium' | 'admin';
  signup_date?: string;
  app_version?: string;
  device_type?: string;
  preferred_team?: string;
  engagement_level?: 'low' | 'medium' | 'high';
  [key: string]: string | number | boolean | undefined;
}