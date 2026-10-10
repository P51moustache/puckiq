/** NHL Edge telemetry on the player card. Free users see the headline metric; the panel is Pro. */

import React from 'react';
import { useNhlToday } from '../../hooks/useCoach';
import { useResource } from '../../hooks/useResource';
import { seasonIdFor } from '../../services/nhl/dates';
import { fetchPlayerEdge } from '../../services/nhl/edge';
import { EdgePanel } from '../coach/EdgePanel';
import { Pill, SectionLabel } from '../coach/ui';

export function TelemetrySection({
  playerId,
  goalie,
  isPro,
  onUnlock,
}: {
  playerId: number;
  goalie: boolean;
  isPro: boolean;
  onUnlock: () => void;
}) {
  const season = seasonIdFor(useNhlToday());
  const edge = useResource(`edge:${playerId}:${goalie ? 'g' : 's'}:${season}`, (force) => fetchPlayerEdge(playerId, goalie, season, { force }));
  if (!edge.loading && !edge.data) return null;
  return (
    <>
      <SectionLabel title="Telemetry" right={!isPro ? <Pill label="PRO" tone="accent" /> : null} />
      <EdgePanel edge={edge.data} loading={edge.loading} isPro={isPro} onUnlock={onUnlock} />
    </>
  );
}
