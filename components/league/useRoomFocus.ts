/**
 * Focus for League screens: true while the screen is focused, and the room keeps polling for as
 * long as it is. Tabs stay mounted after their first visit, so "mounted" isn't "on screen".
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useLeague } from './LeagueProvider';

export function useRoomFocus(): boolean {
  const { watch } = useLeague();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const stop = watch();
      return () => {
        setFocused(false);
        stop();
      };
    }, [watch]),
  );
  return focused;
}
