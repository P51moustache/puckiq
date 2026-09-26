/**
 * One source of truth for the user's fantasy teams. Every tab reads from here,
 * so a roster edit on one tab shows up on the others immediately.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FantasyTeam, TeamsState } from '../types/fantasy';
import {
  activeTeamOf,
  createTeam as buildTeam,
  deleteTeam,
  emptyTeamsState,
  loadTeamsState,
  saveTeamsState,
  upsertTeam,
} from '../services/teams';
import { track } from '../services/analytics/track';

interface TeamsContextValue {
  ready: boolean;
  teams: FantasyTeam[];
  team: FantasyTeam | null;
  setActiveTeam: (teamId: string) => void;
  /** Apply an update to one team (defaults to the active team). */
  updateTeam: (update: (team: FantasyTeam) => FantasyTeam, teamId?: string) => void;
  addTeam: (input: Parameters<typeof buildTeam>[0]) => FantasyTeam;
  removeTeam: (teamId: string) => void;
  replaceAll: (state: TeamsState) => void;
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TeamsState>(emptyTeamsState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadTeamsState().then((next) => {
      if (cancelled) return;
      loaded.current = true;
      setState(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    saveTeamsState(state).catch((error) => console.warn('[TEAMS] Save failed:', error));
  }, [state]);

  const setActiveTeam = useCallback((teamId: string) => {
    setState((prev) => (prev.teams.some((team) => team.id === teamId) ? { ...prev, activeTeamId: teamId } : prev));
  }, []);

  const updateTeam = useCallback((update: (team: FantasyTeam) => FantasyTeam, teamId?: string) => {
    setState((prev) => {
      const target = teamId ? prev.teams.find((team) => team.id === teamId) : activeTeamOf(prev);
      if (!target) return prev;
      return upsertTeam(prev, update(target));
    });
  }, []);

  const addTeam = useCallback((input: Parameters<typeof buildTeam>[0]) => {
    const team = buildTeam(input);
    track('team_add', { platform: team.platform });
    setState((prev) => ({ ...upsertTeam(prev, team), activeTeamId: team.id }));
    return team;
  }, []);

  const removeTeam = useCallback((teamId: string) => {
    setState((prev) => deleteTeam(prev, teamId));
  }, []);

  const replaceAll = useCallback((next: TeamsState) => {
    loaded.current = true;
    setState(next);
    setReady(true);
  }, []);

  const value = useMemo<TeamsContextValue>(() => ({
    ready,
    teams: state.teams,
    team: activeTeamOf(state),
    setActiveTeam,
    updateTeam,
    addTeam,
    removeTeam,
    replaceAll,
  }), [ready, state, setActiveTeam, updateTeam, addTeam, removeTeam, replaceAll]);

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams(): TeamsContextValue {
  const value = useContext(TeamsContext);
  if (!value) throw new Error('useTeams must be used within a TeamsProvider');
  return value;
}
