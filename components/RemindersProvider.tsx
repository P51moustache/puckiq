/**
 * Keeps local lineup reminders in step with teams, settings, and the schedule.
 * Re-plans on launch, on foreground, and whenever a roster or setting changes.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { addDays, mondayOf, todayNhl } from '../services/nhl/dates';
import { fetchWeekSchedule } from '../services/nhl/schedule';
import {
  clearLegacyNotifications,
  DEFAULT_REMINDERS,
  getPermissionState,
  getReminderSettings,
  requestReminderPermission,
  saveReminderSettings,
  syncLineupReminders,
  type PermissionState,
  type ReminderSettings,
} from '../services/lineupReminders';
import { useTeams } from './TeamsProvider';
import { track } from '../services/analytics/track';

interface RemindersContextValue {
  settings: ReminderSettings;
  permission: PermissionState;
  /** Turns reminders on (asking permission if needed). Returns false if permission was refused. */
  enable: () => Promise<boolean>;
  update: (settings: ReminderSettings) => Promise<void>;
}

const RemindersContext = createContext<RemindersContextValue | undefined>(undefined);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { ready, teams } = useTeams();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [loaded, setLoaded] = useState(false);
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    clearLegacyNotifications();
    Promise.all([getReminderSettings(), getPermissionState()]).then(([saved, state]) => {
      setSettings(saved);
      setPermission(state);
      setLoaded(true);
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((tick) => tick + 1);
    });
    return () => sub.remove();
  }, []);

  const rosterSignature = useMemo(
    () => teams.map((team) => `${team.name}:${team.players.map((p) => `${p.playerId}${p.teamAbbrev}${p.injuredReserve ? 'ir' : ''}`).join(',')}`).join('|'),
    [teams],
  );

  useEffect(() => {
    if (!loaded || !ready) return;
    let cancelled = false;
    (async () => {
      const state = await getPermissionState();
      if (cancelled) return;
      setPermission(state);
      if (!settings.enabled) {
        await syncLineupReminders([], [], settings);
        return;
      }
      const monday = mondayOf(todayNhl());
      const schedules = await Promise.all([
        fetchWeekSchedule(monday).catch(() => null),
        fetchWeekSchedule(addDays(monday, 7)).catch(() => null),
      ]);
      if (cancelled) return;
      await syncLineupReminders(teams, schedules.filter((s): s is NonNullable<typeof s> => s !== null), settings);
    })().catch((error) => console.warn('[REMINDERS] Sync failed:', error));
    return () => {
      cancelled = true;
    };
    // teams is captured through rosterSignature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ready, rosterSignature, settings, foregroundTick]);

  const update = useCallback(async (next: ReminderSettings) => {
    setSettings(next);
    await saveReminderSettings(next);
  }, []);

  const enable = useCallback(async () => {
    const granted = await requestReminderPermission();
    track('reminders_enable', { granted });
    setPermission(granted ? 'granted' : await getPermissionState());
    if (!granted) return false;
    await update({ ...settings, enabled: true });
    return true;
  }, [settings, update]);

  const value = useMemo(() => ({ settings, permission, enable, update }), [settings, permission, enable, update]);
  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersContextValue {
  const value = useContext(RemindersContext);
  if (!value) throw new Error('useReminders must be used within a RemindersProvider');
  return value;
}
