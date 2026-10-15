import { useEffect, useState } from 'react';
import { PaywallJourney } from '../services/analytics/PaywallJourney';
import { newInstallId } from '../services/analytics/posthog';
import { track } from '../services/analytics/track';

export function usePaywallJourney(visible: boolean, source: string): PaywallJourney {
  const [journey] = useState(() => new PaywallJourney(track, Date.now, newInstallId));
  useEffect(() => {
    if (!visible) return;
    journey.open(source);
    return () => journey.close('hidden');
  }, [visible, source, journey]);
  return journey;
}
