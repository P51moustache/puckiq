import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import type { FantasyTeam } from '../types/fantasy';
import type { NightView } from './useCoach';
import { needsPersonalRoster } from '../services/fantasy/proOpportunity';
import { rosterBrief, rosterSnapshot, type RosterSnapshot } from '../services/engagement/rosterBrief';
import { RosterBriefStore } from '../services/engagement/RosterBriefStore';
import { track } from '../services/analytics/track';
import { lineupCheckedAt } from '../services/fantasy/lineupChecks';

interface Visit { teamId: string; latest: RosterSnapshot | null; previous: RosterSnapshot | null }

/** Hold the prior visit fixed while this visit refreshes; commit only valid current inputs on exit. */
export function useRosterBrief(team: FantasyTeam | null, view: NightView, enabled: boolean) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [store] = useState(() => new RosterBriefStore(AsyncStorage, Date.now));
  const visit = useRef<Visit | null>(null);
  const [baseline, setBaseline] = useState<Visit | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const availability = useRef<string | null>(null);
  const usableTeam = enabled && team && !needsPersonalRoster(team) ? team : null;
  const checkedAt = lineupCheckedAt(view.checks ?? [], Date.now());
  const snapshot = useMemo(() => usableTeam && view.night.data && view.bestDay && !view.loading && !view.error && !view.night.refreshing && checkedAt !== null
    ? rosterSnapshot({ team: usableTeam, date: view.date, checkedAt, statuses: view.night.data.statuses, goalies: view.goalieOutlooks, empty: view.bestDay.empty }) : null,
  [usableTeam, view.night.data, view.bestDay, view.loading, view.error, view.night.refreshing, checkedAt, view.date, view.goalieOutlooks]);
  const latest = useRef({ teamId: usableTeam?.id, snapshot });
  latest.current = { teamId: usableTeam?.id, snapshot };
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => listener.remove();
  }, []);
  const teamId = usableTeam?.id;
  useEffect(() => {
    if (!teamId || !focused || !active) { setBaseline(null); return; }
    const current: Visit = { teamId, latest: latest.current.teamId === teamId ? latest.current.snapshot : null, previous: null };
    visit.current = current;
    setDismissed(false);
    availability.current = null;
    let cancelled = false;
    store.load(teamId).then((previous) => {
      if (cancelled) return;
      current.previous = previous;
      setBaseline({ ...current });
    });
    return () => {
      cancelled = true;
      if (current.latest) void store.save(teamId, current.latest).catch(() => undefined);
      if (visit.current === current) visit.current = null;
    };
  }, [teamId, focused, active, store]);
  useEffect(() => {
    const current = visit.current;
    if (snapshot && current && current.teamId === teamId) current.latest = snapshot;
  }, [snapshot, teamId]);
  const items = usableTeam && snapshot && baseline && baseline.teamId === teamId && !dismissed && focused && active
    ? rosterBrief(baseline.previous, snapshot, usableTeam) : [];
  const signature = items.map((item) => `${item.kind}:${item.playerId ?? item.slot}`).join('|');
  useEffect(() => {
    if (!signature || availability.current === signature) return;
    availability.current = signature;
    track('roster_brief_available', { changes: signature.split('|').length });
  }, [signature]);
  const dismiss = () => {
    track('roster_brief_dismiss', { changes: items.length });
    setDismissed(true);
  };
  return { items, dismiss };
}
