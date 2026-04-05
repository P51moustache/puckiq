import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from './auth/AuthProvider';
import { initializeSubscription, isPro } from '../services/subscription';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkProStatus = useCallback(async () => {
    try {
      const pro = await isPro();
      setIsPremium(pro);
    } catch {
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await initializeSubscription(user?.id);
      await checkProStatus();
    };
    init();
  }, [user?.id, checkProStatus]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await checkProStatus();
  }, [checkProStatus]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ isPremium, loading, refresh }),
    [isPremium, loading, refresh],
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
