/**
 * Keeps local lineup reminders in step with teams, settings, and the schedule.
 * Re-plans on launch, on foreground, and whenever a roster, a team's league settings, or a
 * reminder setting changes. Each plan loads the teams' lineups so reminders can name the moves;
 * if that fails, reminders still go out with player counts.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import { todayNhl } from '../services/nhl/dates';
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
import { loadReminderInputs } from '../services/reminders/reminderInputs';
import { useTeams } from './TeamsProvider';
import { track } from '../services/analytics/track';

/** Which ask turned reminders on (analytics). */
export type ReminderSource = 'onboarding' | 'tonight_prompt' | 'first_night' | 'settings';

export interface EnableRemindersOptions {
  source: ReminderSource;
  /** Also notify when the night goes live. Only asks that promise it may turn it on. */
  liveStart?: boolean;
}

interface RemindersContextValue {
  settings: ReminderSettings;
  permission: PermissionState;
  /** Turns reminders on (asking permission if needed). Returns false if permission was refused. */
  enable: (options: EnableRemindersOptions) => Promise<boolean>;
  update: (settings: ReminderSettings) => Promise<void>;
}

const RemindersContext = createContext<RemindersContextValue | undefined>(undefined);

/** Everything about a team a reminder depends on: who plays, where they fit, and how they rank. */
function teamSignature(team: FantasyTeam): string {
  const players = team.players
    .map((p) => `${p.playerId}${p.teamAbbrev}${p.position}${(p.eligible ?? []).join('/')}${p.injuredReserve ? 'ir' : ''}`)
    .join(',');
  return `${team.id}:${team.name}:${JSON.stringify(team.slots)}:${JSON.stringify(team.scoring)}:${players}`;
}

/** The team on screen first: its lineup loads share the screens' requests. */
function activeFirst(teams: FantasyTeam[], activeId: string | undefined): FantasyTeam[] {
  return [...teams].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));
}

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { ready, teams, team: activeTeam } = useTeams();
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

  const teamsSignature = useMemo(() => teams.map(teamSignature).join('|'), [teams]);

  useEffect(() => {
    if (!loaded || !ready) return;
    let cancelled = false;
    (async () => {
      const state = await getPermissionState();
      if (cancelled) return;
      setPermission(state);
      if (!settings.enabled || state !== 'granted') {
        // Clears anything still scheduled; nothing new is planned.
        await syncLineupReminders([], [], settings);
        return;
      }
      const { schedules, lineups } = await loadReminderInputs(activeFirst(teams, activeTeam?.id), todayNhl());
      if (cancelled) return;
      await syncLineupReminders(teams, schedules, settings, lineups);
    })().catch((error) => console.warn('[REMINDERS] Sync failed:', error));
    return () => {
      cancelled = true;
    };
    // teams is captured through teamsSignature; the active team only orders the loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ready, teamsSignature, settings, foregroundTick]);

  const update = useCallback(async (next: ReminderSettings) => {
    setSettings(next);
    await saveReminderSettings(next);
  }, []);

  const enable = useCallback(async ({ source, liveStart }: EnableRemindersOptions) => {
    const granted = await requestReminderPermission();
    track('reminders_enable', { granted, source, live_start: liveStart === true });
    setPermission(granted ? 'granted' : await getPermissionState());
    if (!granted) return false;
    await update({ ...settings, enabled: true, liveStart: liveStart ?? settings.liveStart });
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
