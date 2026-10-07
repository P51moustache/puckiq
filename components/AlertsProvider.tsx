/**
 * Keeps this device registered for scratch and goal alerts on the players it follows, and
 * opens Tonight when one is tapped. Registers on launch, on roster changes and on setting
 * changes — only when what the server would store actually changed.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import {
  alertPlayerIds,
  alertSignature,
  DEFAULT_ALERTS,
  getExpoPushToken,
  loadAlertSettings,
  registerAlerts,
  saveAlertSettings,
  unregisterAlerts,
  type AlertSettings,
} from '../services/alerts';
import { requestReminderPermission } from '../services/lineupReminders';
import { track } from '../services/analytics/track';
import { useTeams } from './TeamsProvider';

/** Roster edits come in bursts (adding five players); register once they settle. */
const REGISTER_DEBOUNCE_MS = 4000;

interface AlertsContextValue {
  settings: AlertSettings;
  /** Asks for notification permission if needed. False when refused or unsupported. */
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  update: (patch: Partial<Pick<AlertSettings, 'scratches' | 'goals'>>) => Promise<void>;
}

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { ready, teams } = useTeams();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERTS);
  const [loaded, setLoaded] = useState(false);
  const token = useRef<string | null>(null);
  const lastSignature = useRef<string | null>(null);
  const playerIds = useMemo(() => alertPlayerIds(teams), [teams]);
  const idsKey = playerIds.join(',');

  useEffect(() => {
    loadAlertSettings().then((saved) => {
      setSettings(saved);
      setLoaded(true);
    });
    const sub = Notifications.addNotificationResponseReceivedListener?.((response) => {
      const kind = (response.notification.request.content.data as { kind?: string } | undefined)?.kind;
      if (kind === 'goal' || kind === 'scratch') router.push('/' as Href);
    });
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (!loaded || !ready || !settings.enabled) return;
    const timer = setTimeout(async () => {
      token.current = token.current ?? (await getExpoPushToken());
      if (!token.current) return;
      const signature = alertSignature(token.current, playerIds, settings);
      if (signature === lastSignature.current) return;
      if (await registerAlerts(token.current, playerIds, settings, Constants.expoConfig?.version ?? '')) {
        lastSignature.current = signature;
      }
    }, REGISTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // playerIds is captured through idsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ready, settings, idsKey]);

  const persist = useCallback(async (next: AlertSettings) => {
    setSettings(next);
    await saveAlertSettings(next);
  }, []);

  const enable = useCallback(async () => {
    const granted = await requestReminderPermission();
    const deviceToken = granted ? await getExpoPushToken() : null;
    track('alerts_enable', { granted, supported: !!deviceToken, scratches: settings.scratches, goals: settings.goals });
    if (!deviceToken) return false;
    token.current = deviceToken;
    await persist({ ...settings, enabled: true });
    return true;
  }, [settings, persist]);

  const disable = useCallback(async () => {
    await persist({ ...settings, enabled: false });
    lastSignature.current = null;
    const deviceToken = token.current ?? (await getExpoPushToken());
    if (deviceToken) await unregisterAlerts(deviceToken);
  }, [settings, persist]);

  const update = useCallback(async (patch: Partial<Pick<AlertSettings, 'scratches' | 'goals'>>) => {
    await persist({ ...settings, ...patch });
  }, [settings, persist]);

  const value = useMemo(() => ({ settings, enable, disable, update }), [settings, enable, disable, update]);
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): AlertsContextValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error('useAlerts must be used within an AlertsProvider');
  return value;
}
