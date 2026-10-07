import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { UsageJourney } from '../services/analytics/usageJourney';
import AnalyticsService from '../services/analytics/AnalyticsService';
import { track, trackScreen } from '../services/analytics/track';

/** Records real foreground visits and flushes before the app is suspended. */
export function useUsageJourney(screen: string | null): void {
  const journey = useRef<UsageJourney | null>(null);
  if (journey.current === null) {
    journey.current = new UsageJourney(Date.now, (event, properties) => {
      if (event === 'screen_view') trackScreen(String(properties.screen_name));
      else track(event, properties);
    });
  }

  useEffect(() => {
    const usage = journey.current!;
    usage.setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', (state) => {
      usage.setActive(state === 'active');
      if (state !== 'active') void AnalyticsService.getInstance().flush();
    });
    return () => { listener.remove(); usage.setActive(false); };
  }, []);

  useEffect(() => { journey.current!.navigate(screen); }, [screen]);
}
