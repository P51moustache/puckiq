/**
 * The card's roster buttons, by where it was opened and whose he is: Remove (mine), Remove from
 * opponent (theirs), or Add to my team; plus "Already taken" when he came up as a pickup.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { PlayerSheetContext } from '../sheets/PlayerSheet';
import { GhostButton, PrimaryButton } from '../coach/ui';
import type { RosterActions } from './useRosterActions';

export function PlayerActions({
  context,
  onMyRoster,
  onOpponent,
  hasTeam,
  actions,
}: {
  context: PlayerSheetContext;
  onMyRoster: boolean;
  onOpponent: boolean;
  hasTeam: boolean;
  actions: Pick<RosterActions, 'addToMyTeam' | 'remove' | 'markTaken'>;
}) {
  return (
    <View style={styles.actions}>
      {context === 'roster' || onMyRoster ? (
        <GhostButton label="Remove" icon="remove" tone="bad" onPress={() => actions.remove('players')} testID="player-remove" />
      ) : context === 'opponent' || onOpponent ? (
        <GhostButton label="Remove from opponent" icon="remove" tone="bad" onPress={() => actions.remove('opponent')} />
      ) : (
        <PrimaryButton label="Add to my team" icon="add" onPress={actions.addToMyTeam} testID="player-add" style={styles.addButton} />
      )}
      {context === 'pickup' && hasTeam ? (
        <GhostButton label="Already taken" icon="eye-off-outline" tone="ink" onPress={actions.markTaken} testID="player-hide" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  addButton: {
    flex: 1,
  },
});
