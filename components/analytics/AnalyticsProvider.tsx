import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AnalyticsService from '../../services/analytics/AnalyticsService';

interface AnalyticsContextType {
  analytics: AnalyticsService;
  ready: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface AnalyticsProviderProps {
  children: ReactNode;
  config?: {
    enabled?: boolean;
    debug?: boolean;
    userId?: string;
  };
}

export function AnalyticsProvider({ children, config }: AnalyticsProviderProps) {
  const analytics = AnalyticsService.getInstance();
  const normalizedConfig = useMemo(
    () => (config ? { ...config } : undefined),
    [config]
  );
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void analytics.initialize(normalizedConfig).then(() => {
      if (!mounted) {
        return;
      }

      const currentAppState = AppState.currentState;
      appState.current = currentAppState;
      if (currentAppState === 'active') {
        analytics.trackSessionStart();
      } else {
        analytics.trackSessionEnd();
      }
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [analytics, normalizedConfig]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const isActive = nextAppState === 'active';
      appState.current = nextAppState;

      if (wasActive === isActive) {
        return;
      }

      if (isActive) {
        analytics.trackSessionStart();
      } else {
        analytics.trackSessionEnd();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [analytics]);

  return (
    <AnalyticsContext.Provider value={{ analytics, ready }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
}
