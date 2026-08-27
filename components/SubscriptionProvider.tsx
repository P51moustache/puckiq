import React, { createContext, useContext, useMemo } from 'react';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

/** Paid app — no RevenueCat, no configure() on launch or later. */
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
