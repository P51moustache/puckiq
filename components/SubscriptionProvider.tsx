import React, { createContext, useCallback, useContext, useMemo } from 'react';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

/**
 * Paid app is one $1.99 tool. Do not talk to RevenueCat on launch (or ever).
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const refresh = useCallback(async () => undefined, []);
  const value = useMemo<SubscriptionContextValue>(
    () => ({ isPremium: true, loading: false, refresh }),
    [refresh],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const value = useContext(SubscriptionContext);
  if (!value) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return value;
}
