import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthContext } from './auth/AuthProvider';
import {
  FREE_STATUS,
  getProStatus,
  initializeSubscription,
  onCustomerInfoChange,
  type ProStatus,
} from '../services/subscription';
import AnalyticsService from '../services/analytics/AnalyticsService';

interface SubscriptionContextValue {
  isPremium: boolean;
  status: ProStatus;
  loading: boolean;
  /** RevenueCat has a key and configured. False in local dev without keys. */
  storeReady: boolean;
  refresh: () => Promise<void>;
  applyStatus: (status: ProStatus) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

/** Local testing only: EXPO_PUBLIC_DEV_PRO=1 in a __DEV__ build unlocks Pro without a store. */
function developerOverride(): ProStatus | null {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEV_PRO === '1') {
    return { isPro: true, source: 'developer', expiresAt: null, willRenew: false };
  }
  return null;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [status, setStatus] = useState<ProStatus>(() => developerOverride() ?? FREE_STATUS);
  const [loading, setLoading] = useState(true);
  const [storeReady, setStoreReady] = useState(false);

  const checkProStatus = useCallback(async () => {
    const override = developerOverride();
    try {
      setStatus(override ?? (await getProStatus()));
    } catch {
      setStatus(override ?? FREE_STATUS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const ready = await initializeSubscription(user?.id);
      if (cancelled) return;
      setStoreReady(ready);
      await checkProStatus();
      unsubscribe = onCustomerInfoChange((next) => setStatus(developerOverride() ?? next));
    };
    init();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id, checkProStatus]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await checkProStatus();
  }, [checkProStatus]);

  const applyStatus = useCallback((next: ProStatus) => {
    setStatus(developerOverride() ?? next);
  }, []);

  // Recheck on foreground and at gift expiry, including offline cached receipts.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkProStatus();
    });
    return () => listener.remove();
  }, [checkProStatus]);

  useEffect(() => {
    if (status.source !== 'loyalty' || !status.expiresAt) return;
    // setTimeout cannot represent more than ~24.8 days; recheck daily instead.
    const delay = Math.max(1000, Math.min(24 * 60 * 60 * 1000, Date.parse(status.expiresAt) - Date.now()));
    const timer = setTimeout(() => { void checkProStatus(); }, delay);
    return () => clearTimeout(timer);
  }, [status, checkProStatus]);

  useEffect(() => {
    AnalyticsService.getInstance().register({ is_pro: status.isPro });
  }, [status.isPro]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ isPremium: status.isPro, status, loading, storeReady, refresh, applyStatus }),
    [status, loading, storeReady, refresh, applyStatus],
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
