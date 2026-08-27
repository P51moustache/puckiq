import React, { createContext, useContext, useMemo } from 'react';

/**
 * Leftover screens still call useSubscription.
 * Never initialize RevenueCat — that SDK stays out.
 */
interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium: true,
      loading: false,
      refresh: async () => undefined,
    }),
    [],
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
    return {
      isPremium: true,
      loading: false,
      refresh: async () => undefined,
    };
  }
  return value;
}
