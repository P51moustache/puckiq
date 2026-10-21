/**
 * Tonight's guidance: the first-night guide, the game-night reminder offer, the review ask and
 * "up next" — when each shows and what each tap does. TonightScreen only renders them.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import type { FantasyPlayer, FantasyTeam } from '../types/fantasy';
import type { FirstNightStep } from '../services/engagement/firstNight';
import type { NextUpItem } from '../services/fantasy/nextUp';
import type { NightScore } from '../services/fantasy/nightScore';
import { hasSamplePlayers } from '../constants/sampleTeam';
import { track } from '../services/analytics/track';
import { useReminders } from '../components/RemindersProvider';
import { usePlayerSheet } from '../components/sheets/PlayerSheet';
import type { NightView } from './useCoach';
import { useFirstNight } from './useFirstNight';
import { reminderMoment } from '../services/engagement/reminderPrompt';
import { reviewMoment } from '../services/engagement/reviewPrompt';
import { useNextUp } from './useNextUp';
import { useReminderPrompt, type ReminderPrompt } from './useReminderPrompt';
import { useReviewPrompt, type ReviewPrompt } from './useReviewPrompt';

export interface TonightGuidanceArgs {
  team: FantasyTeam | null;
  view: NightView;
  night: 'tonight' | 'tomorrow';
  /** My players with a game on the viewed night, as Tonight lists them. */
  playing: FantasyPlayer[];
  isPro: boolean;
  /** Last night's score while its recap card is on screen (Tonight, mornings), else null. */
  recap: NightScore | null;
  /** Switch to the next night and back to the top. */
  showTomorrow: () => void;
  /** Scroll to "Your players tonight". */
  showPlayers: () => void;
}

export interface FirstNightView {
  visible: boolean;
  done: readonly FirstNightStep[];
  /** None of my players play on the viewed night. */
  quietNight: boolean;
  onStep: (step: FirstNightStep) => void;
  onDismiss: () => void;
}

export interface TonightGuidance {
  firstNight: FirstNightView;
  reminderPrompt: ReminderPrompt;
  reviewPrompt: ReviewPrompt;
  nextUp: { item: NextUpItem | null; onPress: () => void };
}

export function useTonightGuidance({ team, view, night, playing, isPro, recap, showTomorrow, showPlayers }: TonightGuidanceArgs): TonightGuidance {
  const router = useRouter();
  const { openPlayer } = usePlayerSheet();
  const { settings, permission, enable } = useReminders();
  const guide = useFirstNight(settings.enabled && permission === 'granted');
  const isTonight = night === 'tonight';
  // Before lock, after it (most visits come during or after the games) or on the morning recap.
  const moment = isTonight
    ? reminderMoment({ recapShown: !!recap, playingTonight: playing.length > 0, beforePuck: (view.score?.phase ?? 'pre') === 'pre' })
    : null;
  // Asked after value: tonight's lineup call (view.day) or the recap has to be on screen first.
  const reminderPrompt = useReminderPrompt({ moment, callShown: moment === 'recap' || !!view.day });
  const guideVisible = isTonight && guide.active && (team?.players.length ?? 0) > 0;
  // Asked only after a good night shows in the recap, and never on top of the reminder offer.
  const reviewPrompt = useReviewPrompt({
    moment: isTonight ? reviewMoment(recap) : null,
    sampleTeam: hasSamplePlayers(team),
    onboarding: guideVisible,
    otherPrompt: reminderPrompt.moment !== null,
    otherPromptShown: reminderPrompt.visible,
    live: isTonight && view.score?.phase === 'live',
  });
  const item = useNextUp({ team, view, night, playing, isPro });
  useNextUpViewed(item, view.date);

  const { complete } = guide;
  const onStep = useCallback(async (step: FirstNightStep) => {
    if (step === 'players') {
      if (playing.length > 0) showPlayers();
      else showTomorrow();
    } else if (step === 'pickup') {
      router.push('/pickups' as Href);
    } else {
      await enable({ source: 'first_night', liveStart: true });
    }
    // An attempt counts: a refused permission shouldn't leave the guide stuck on its last step.
    complete(step);
  }, [playing.length, showPlayers, showTomorrow, router, enable, complete]);

  const onNextUp = useCallback(() => {
    if (!item) return;
    track('next_up_tap', { kind: item.kind });
    const { action } = item;
    switch (action.type) {
      case 'pickups':
        router.push({ pathname: '/pickups', params: { date: action.date, slot: action.slot } } as unknown as Href);
        break;
      case 'player':
        openPlayer(action.playerId, 'roster', 'next_up');
        break;
      case 'tomorrow':
        showTomorrow();
        break;
      case 'week':
        router.push('/week' as Href);
        break;
      case 'roster':
        router.push('/myteam' as Href);
        break;
    }
  }, [item, router, openPlayer, showTomorrow]);

  return {
    firstNight: {
      visible: guideVisible,
      done: guide.done,
      quietNight: !!view.night.data && playing.length === 0,
      onStep,
      onDismiss: guide.dismiss,
    },
    reminderPrompt,
    reviewPrompt,
    nextUp: { item, onPress: onNextUp },
  };
}

/** One `next_up_view` per night and kind, never per render. */
function useNextUpViewed(item: NextUpItem | null, date: string): void {
  const sent = useRef<string | null>(null);
  const kind = item?.kind ?? null;
  useEffect(() => {
    if (!kind) return;
    const key = `${date}:${kind}`;
    if (sent.current === key) return;
    sent.current = key;
    track('next_up_view', { kind });
  }, [kind, date]);
}
