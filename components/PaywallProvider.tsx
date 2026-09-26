/**
 * One paywall for the whole app. Any Pro teaser calls `openPaywall(source)`.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PaywallSource } from '../constants/monetization';
import ProPaywall from './ProPaywall';

interface PaywallContextValue {
  openPaywall: (source: PaywallSource) => void;
}

const PaywallContext = createContext<PaywallContextValue | undefined>(undefined);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<PaywallSource | null>(null);
  const openPaywall = useCallback((next: PaywallSource) => setSource(next), []);
  const value = useMemo(() => ({ openPaywall }), [openPaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <ProPaywall visible={source !== null} source={source ?? 'settings'} onClose={() => setSource(null)} />
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const value = useContext(PaywallContext);
  if (!value) throw new Error('usePaywall must be used within a PaywallProvider');
  return value;
}
