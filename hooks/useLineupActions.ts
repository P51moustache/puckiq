import { Alert } from 'react-native';
import { useNhlToday, type NightView } from './useCoach';
import { useTeams } from '../components/TeamsProvider';
import { useNow } from '../components/coach/format';
import { appNow } from '../services/nhl/dates';
import {
  lineupLocked,
  saveBestLineup,
  setLineupChoice,
  starterChoiceError,
  starterReplacements,
} from '../services/fantasy/lineupPlan';

/** All lineup edits use the same eligibility and lock rules and persist through TeamsProvider. */
export function useLineupActions(view: NightView) {
  const { team, updateTeam } = useTeams();
  const now = useNow();
  const today = useNhlToday();
  const loaded =
    !!view.bestDay && !!view.night.data && !view.loading && !view.error;
  const locked =
    !!view.night.data && lineupLocked(view.night.data.games ?? [], now);
  const lockedAtAction = () =>
    !view.night.data || lineupLocked(view.night.data.games ?? [], appNow());
  const edit = (playerId: number, choice: 'start' | 'sit') => {
    if (!team || !view.bestDay || !loaded || lockedAtAction()) return;
    const error =
      choice === 'start'
        ? starterChoiceError(team, view.bestDay, playerId, view.lineupValues)
        : null;
    if (error) {
      const replacements =
        choice === 'start'
          ? starterReplacements(
              team,
              view.bestDay,
              playerId,
              view.lineupValues,
            ).slice(0, 2)
          : [];
      if (!replacements.length) {
        Alert.alert('Lineup choice', error);
        return;
      }
      Alert.alert(
        'Choose a starter swap',
        'His eligible slots are full. Choose a saved starter to bench for this date.',
        [
          ...replacements.map((id) => ({
            text: `Bench ${team.players.find((p) => p.playerId === id)?.playerName ?? 'starter'}`,
            onPress: () => {
              if (lockedAtAction()) return;
              updateTeam((current) => {
                if (current.id !== team.id) return current;
                const next = setLineupChoice(current, view.date, id, 'sit', today);
                return view.bestDay &&
                  !starterChoiceError(
                    next,
                    view.bestDay,
                    playerId,
                    view.lineupValues,
                  )
                  ? setLineupChoice(next, view.date, playerId, 'start', today)
                  : current;
              });
            },
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    updateTeam((current) =>
      current.id === team.id ? setLineupChoice(current, view.date, playerId, choice, today) : current,
    );
  };
  const applyBest = () => {
    if (!team || !view.bestDay || !loaded || lockedAtAction()) return;
    const day = view.bestDay;
    updateTeam((current) => current.id === team.id ? saveBestLineup(current, day, today) : current);
  };
  const reset = () => {
    if (!loaded || lockedAtAction()) return;
    updateTeam((current) => {
      const choices = { ...current.lineupChoices };
      delete choices[view.date];
      return { ...current, lineupChoices: choices };
    });
  };
  return { locked, loaded, edit, applyBest, reset };
}
