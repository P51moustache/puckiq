import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthContext } from './auth/AuthProvider';
import PaywallModal from './PaywallModal';
import {
  hasProEntitlement,
  initializeSubscription,
  isPro,
  setSubscriptionUser,
  subscribeToCustomerInfo,
} from '../services/subscription';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  showPaywall: (featureHeadline?: string) => void;
  subscriptionUnavailableReason: string | null;
  retrySubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallHeadline, setPaywallHeadline] = useState<string | undefined>();
  const [subscriptionUnavailableReason, setSubscriptionUnavailableReason] = useState<string | null>(null);
  const [retryRequest, setRetryRequest] = useState(0);
  const identityRequest = useRef(0);
  const desiredUserId = user?.id ?? null;
  const desiredUserIdRef = useRef(desiredUserId);
  const confirmedUserIdRef = useRef<string | null>(null);
  const identityConfirmedRef = useRef(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [entitlementUserId, setEntitlementUserId] = useState<string | null>(null);

  desiredUserIdRef.current = desiredUserId;

  useEffect(() => {
    let mounted = true;
    const requestId = ++identityRequest.current;
    let unsubscribe: () => void = () => undefined;
    confirmedUserIdRef.current = null;
    identityConfirmedRef.current = false;
    setIdentityConfirmed(false);
    setSubscriptionUnavailableReason(null);
    setPaywallVisible(false);
    setPaywallHeadline(undefined);

    const init = async () => {
      setLoading(true);
      setIsPremium(false);
      setEntitlementUserId(null);

      const configured = await initializeSubscription();
      if (
        !mounted
        || requestId !== identityRequest.current
        || desiredUserIdRef.current !== desiredUserId
      ) {
        return;
      }

      if (!configured) {
        if (
          mounted
          && requestId === identityRequest.current
          && desiredUserIdRef.current === desiredUserId
        ) {
          setSubscriptionUnavailableReason('RevenueCat is not configured for this platform.');
          setLoading(false);
        }
        return;
      }

      try {
        const customerInfo = await setSubscriptionUser(desiredUserId ?? undefined);
        if (
          !mounted
          || requestId !== identityRequest.current
          || desiredUserIdRef.current !== desiredUserId
        ) {
          return;
        }

        confirmedUserIdRef.current = desiredUserId;
        identityConfirmedRef.current = true;
        setIdentityConfirmed(true);
        setSubscriptionUnavailableReason(null);
        setEntitlementUserId(desiredUserId);
        setIsPremium(customerInfo ? hasProEntitlement(customerInfo) : false);
        unsubscribe = subscribeToCustomerInfo((nextCustomerInfo) => {
          if (
            mounted
            && requestId === identityRequest.current
            && desiredUserIdRef.current === desiredUserId
            && confirmedUserIdRef.current === desiredUserId
          ) {
            setIsPremium(hasProEntitlement(nextCustomerInfo));
          }
        });
        if (mounted && requestId === identityRequest.current) {
          setLoading(false);
        }
      } catch {
        if (
          mounted
          && requestId === identityRequest.current
          && desiredUserIdRef.current === desiredUserId
        ) {
          confirmedUserIdRef.current = null;
          identityConfirmedRef.current = false;
          setIdentityConfirmed(false);
          setIsPremium(false);
          setEntitlementUserId(null);
          setSubscriptionUnavailableReason('Subscription identity could not be confirmed.');
          setLoading(false);
        }
      }
    };
    init();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [desiredUserId, retryRequest]);

  const retrySubscription = useCallback(async () => {
    setSubscriptionUnavailableReason(null);
    setLoading(true);
    setRetryRequest((request) => request + 1);
  }, []);

  const refresh = useCallback(async () => {
    const requestId = identityRequest.current;
    const requestedUserId = desiredUserIdRef.current;
    setLoading(true);
    try {
      const pro = await isPro();
      if (
        identityConfirmedRef.current
        && requestId === identityRequest.current
        && requestedUserId === desiredUserIdRef.current
        && confirmedUserIdRef.current === requestedUserId
      ) {
        setIsPremium(pro);
        setEntitlementUserId(requestedUserId);
        setLoading(false);
      }
    } catch {
      if (
        identityConfirmedRef.current
        && requestId === identityRequest.current
        && requestedUserId === desiredUserIdRef.current
        && confirmedUserIdRef.current === requestedUserId
      ) {
        setIsPremium(false);
        setEntitlementUserId(requestedUserId);
        setLoading(false);
      }
    }
  }, []);

  const showPaywall = useCallback((featureHeadline?: string) => {
    if (
      !identityConfirmed
      || loading
      || entitlementUserId !== desiredUserId
      || confirmedUserIdRef.current !== desiredUserId
    ) {
      return;
    }
    setPaywallHeadline(featureHeadline);
    setPaywallVisible(true);
  }, [desiredUserId, entitlementUserId, identityConfirmed, loading]);

  const value = useMemo<SubscriptionContextValue>(
    () => {
      const identitySwitching = identityConfirmed && entitlementUserId !== desiredUserId;
      return {
        isPremium: identityConfirmed && !loading && !identitySwitching && isPremium,
        loading: loading || identitySwitching,
        refresh,
        showPaywall,
        subscriptionUnavailableReason: identityConfirmed ? null : subscriptionUnavailableReason,
        retrySubscription,
      };
    },
    [
      desiredUserId,
      entitlementUserId,
      identityConfirmed,
      isPremium,
      loading,
      refresh,
      retrySubscription,
      showPaywall,
      subscriptionUnavailableReason,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <PaywallModal
        visible={
          paywallVisible
          && identityConfirmed
          && !loading
          && entitlementUserId === desiredUserId
          && confirmedUserIdRef.current === desiredUserId
        }
        onClose={() => setPaywallVisible(false)}
        featureHeadline={paywallHeadline}
        refresh={refresh}
      />
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
