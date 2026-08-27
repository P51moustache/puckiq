import React, { createContext, useCallback, useContext, useMemo } from 'react';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

/**
 * Stub provider. Paid $1.99 app — no Pro, no RevenueCat native calls.
 * A previous App Store launch abort was RNPurchases on the TurboModule queue.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const refresh = useCallback(async () => {}, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ isPremium: false, loading: false, refresh }),
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
