/**
 * The side effects of a live night, kept out of the screen: a haptic when one of my players
 * scores, the home-screen widget snapshot, and the Lock Screen Live Activity the user follows.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import type { GameLine } from '../services/nhl/gamecenter';
import { appNow } from '../services/nhl/dates';
import { newGoalScorers } from '../services/fantasy/nightScore';
import { buildLiveActivityState, buildWidgetSnapshot } from '../services/widgets/snapshot';
import {
  endLiveActivity,
  liveActivitiesSupported,
  publishWidgetSnapshot,
  startOrUpdateLiveActivity,
} from '../services/native/widgetBridge';
import { track } from '../services/analytics/track';
import { goalHaptic } from '../components/coach/motion';
import { useStoredFlag } from './useStoredFlag';
import type { NightView } from './useCoach';

/** Remembered across nights: once someone follows on the Lock Screen, game nights start it. */
export const FOLLOW_LIVE_KEY = 'puckiq_follow_live';

/** Buzz when a refresh brings a new goal by one of my players (app in the foreground). */
export function useGoalHaptics(lines: Map<number, GameLine> | undefined, enabled: boolean): void {
  const previous = useRef<Map<number, GameLine> | null>(null);
  useEffect(() => {
    if (!lines) return;
    if (enabled && previous.current && AppState.currentState === 'active' && newGoalScorers(previous.current, lines).length > 0) {
      goalHaptic();
    }
    previous.current = lines;
  }, [lines, enabled]);
}

export interface FollowLive {
  supported: boolean;
  following: boolean;
  setFollowing: (next: boolean) => void;
}

/**
 * Publish tonight to the widgets whenever what they'd show changes, and keep the Live
 * Activity in step while the user follows. Only for tonight's view (never tomorrow's).
 */
export function useNightPublisher(team: FantasyTeam | null, view: NightView, isPro: boolean, enabled: boolean): FollowLive {
  const [following, setFollowingFlag] = useStoredFlag(FOLLOW_LIVE_KEY, false);
  const [supported] = useState(() => liveActivitiesSupported());
  const lastWidget = useRef('');
  const ended = useRef<string | null>(null);
  const data = view.night.data;

  useEffect(() => {
    if (!enabled || !team || !data) return;
    const snapshot = buildWidgetSnapshot({ team, night: data, score: view.score, isPro, now: appNow() });
    // updatedAt changes every build; compare what the widget would actually show.
    const signature = JSON.stringify({ ...snapshot, updatedAt: null });
    if (signature === lastWidget.current) return;
    lastWidget.current = signature;
    void publishWidgetSnapshot(snapshot);
  }, [enabled, team, data, view.score, isPro]);

  useEffect(() => {
    if (!enabled || !following || !supported || !team || !data) return;
    const state = buildLiveActivityState({ team, night: data, score: view.score, isPro });
    if (!state) return;
    if (view.score?.phase === 'final') {
      if (ended.current === view.date) return;
      ended.current = view.date;
      void endLiveActivity(state);
      return;
    }
    void startOrUpdateLiveActivity({ teamName: team.name, date: view.date }, state);
  }, [enabled, following, supported, team, data, view.score, view.date, isPro]);

  const setFollowing = (next: boolean) => {
    setFollowingFlag(next);
    track(next ? 'live_activity_start' : 'live_activity_stop', { phase: view.score?.phase ?? 'none' });
    if (!next) void endLiveActivity();
  };

  return { supported, following, setFollowing };
}
