import React, { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import AnalyticsService from '../../services/analytics/AnalyticsService';

interface AnalyticsContextType {
  analytics: AnalyticsService;
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

  useEffect(() => {
    // Initialize analytics service
    analytics.initialize(normalizedConfig);

    // Note: No cleanup function needed for singleton analytics service
    // The singleton persists across component mounts/unmounts
    // This prevents crashes when app returns from background
  }, [analytics, normalizedConfig]);

  return (
    <AnalyticsContext.Provider value={{ analytics }}>
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
