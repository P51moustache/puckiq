/**
 * One paywall for the whole app. Any Pro teaser calls `openPaywall(source)`.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PaywallSource } from '../constants/monetization';
import ProPaywall from './ProPaywall';
import { track } from '../services/analytics/track';
import { useRouter, type Href } from 'expo-router';
import { useTeams } from './TeamsProvider';
import { needsPersonalRoster, type ProOpportunity } from '../services/fantasy/proOpportunity';

interface PaywallContextValue {
  openPaywall: (source: PaywallSource, opportunity?: ProOpportunity) => void;
  /** Epoch ms the paywall last closed this session, or null; other asks keep clear of it. */
  closedAt: number | null;
}

const PaywallContext = createContext<PaywallContextValue | undefined>(undefined);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<PaywallSource | null>(null);
  const [opportunity, setOpportunity] = useState<ProOpportunity | undefined>();
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const { team, ready } = useTeams();
  const router = useRouter();
  const openPaywall = useCallback((next: PaywallSource, preview?: ProOpportunity) => {
    track('paywall_requested', { source: next });
    if (!ready) return;
    if (next !== 'settings' && needsPersonalRoster(team)) {
      track('paywall_setup_redirect', { source: next });
      router.push({ pathname: '/myteam', params: { setup: '1' } } as Href);
      return;
    }
    setOpportunity(preview);
    setPreviewTeamId(team?.id ?? null);
    setSource(next);
  }, [ready, team, router]);
  const value = useMemo(() => ({ openPaywall, closedAt }), [openPaywall, closedAt]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <ProPaywall visible={source !== null && previewTeamId === (team?.id ?? null)} source={source ?? 'settings'} team={team} opportunity={opportunity} onClose={() => { setSource(null); setClosedAt(Date.now()); }} />
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const value = useContext(PaywallContext);
  if (!value) throw new Error('usePaywall must be used within a PaywallProvider');
  return value;
}
