/**
 * Head-to-head on the Week tab: locked for free, "add your opponent" when there is
 * none (or, in a League Room, a note that the room fills it in), otherwise the
 * carbon matchup card.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { MatchupSummary } from '../../services/fantasy/matchup';
import type { WeekPlan } from '../../services/fantasy/weekPlan';
import type { FantasyTeam } from '../../types/fantasy';
import { Card, colors, GhostButton, LoadingRows, ProLockCard } from '../coach/ui';
import { MatchupCard } from './MatchupCard';

export interface MatchupSectionProps {
  team: Pick<FantasyTeam, 'opponent' | 'opponentName' | 'opponentSource'>;
  isPremium: boolean;
  plan: WeekPlan;
  opponentPlan: WeekPlan | null;
  matchup: MatchupSummary | null;
  /** Opens the opponent roster editor. */
  onEditOpponent: () => void;
  onUnlock: () => void;
}

export function MatchupSection({ team, isPremium, plan, opponentPlan, matchup, onEditOpponent, onUnlock }: MatchupSectionProps) {
  if (!isPremium) {
    return (
      <ProLockCard
        title="Your games vs your opponent’s"
        detail="Add their roster once and see who has more games that count left — and which nights to stream."
        onPress={onUnlock}
        testID="matchup-locked"
      />
    );
  }
  const synced = team.opponentSource === 'room';
  if (team.opponent.length === 0 && synced) {
    return (
      <Card testID="matchup-room-waiting">
        <Text style={styles.matchupEmpty}>
          {team.opponentName || 'Your opponent'} hasn’t added players in your League Room yet. Their roster fills in here when they do.
        </Text>
      </Card>
    );
  }
  if (team.opponent.length === 0) {
    return (
      <Card>
        <Text style={styles.matchupEmpty}>Add this week’s opponent’s players to compare games left under the same lineup rules.</Text>
        <GhostButton label="Add opponent’s players" icon="person-add-outline" onPress={onEditOpponent} style={styles.matchupButton} testID="matchup-add" />
      </Card>
    );
  }
  if (!matchup || !opponentPlan) return <LoadingRows count={2} />;
  return (
    <MatchupCard
      opponentName={team.opponentName}
      synced={synced}
      plan={plan}
      opponentPlan={opponentPlan}
      matchup={matchup}
      onEdit={onEditOpponent}
    />
  );
}

const styles = StyleSheet.create({
  matchupEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
  },
  matchupButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
});
