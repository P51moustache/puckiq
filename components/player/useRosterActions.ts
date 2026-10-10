/**
 * What the player card can change on my team: add or remove him, mark a pickup "already taken"
 * (two a week free, then the paywall), and his league eligibility and IR flag.
 */

import { Alert } from 'react-native';
import type { FantasyPlayer, SlotPosition } from '../../types/fantasy';
import type { PaywallSource } from '../../constants/monetization';
import { useHideAllowance } from '../../hooks/useHideAllowance';
import { basePositions } from '../../services/fantasy/positions';
import type { PlayerProfile } from '../../services/nhl/player';
import { addPlayers, hidePickup, removePlayer, updatePlayer } from '../../services/teams';
import { useTeams } from '../TeamsProvider';

export interface RosterActions {
  addToMyTeam: () => void;
  /** Asks first, then removes him from my roster or my opponent's. */
  remove: (list: 'players' | 'opponent') => void;
  markTaken: () => void;
  toggleEligible: (pos: SlotPosition) => void;
  toggleIr: () => void;
}

export function useRosterActions({
  playerId,
  profile,
  rosterPlayer,
  isPro,
  onClose,
  onUpsell,
}: {
  playerId: number;
  profile: PlayerProfile | null;
  rosterPlayer: FantasyPlayer | null;
  isPro: boolean;
  onClose: () => void;
  onUpsell: (source: PaywallSource) => void;
}): RosterActions {
  const { team, updateTeam } = useTeams();
  const hides = useHideAllowance(isPro);

  const addToMyTeam = () => {
    if (!profile || !team) return;
    const player: FantasyPlayer = { playerId, playerName: profile.name, teamAbbrev: profile.team, position: profile.position, rosterPosition: 'BN' };
    updateTeam((current) => addPlayers(current, [player], 'players'));
    onClose();
  };

  const remove = (list: 'players' | 'opponent') => {
    if (!profile) return;
    Alert.alert(`Remove ${profile.name}?`, list === 'players' ? 'He’ll come off your PuckIQ roster.' : 'He’ll come off your opponent’s roster.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          updateTeam((current) => removePlayer(current, playerId, list));
          onClose();
        },
      },
    ]);
  };

  const markTaken = () => {
    if (!hides.allowed) {
      onUpsell('pickups_hide');
      return;
    }
    hides.record();
    updateTeam((current) => hidePickup(current, playerId));
    onClose();
  };

  const toggleEligible = (pos: SlotPosition) => {
    if (!rosterPlayer) return;
    const current = basePositions(rosterPlayer);
    const next = current.includes(pos) ? current.filter((value) => value !== pos) : [...current, pos];
    if (next.length === 0) return;
    updateTeam((teamState) => updatePlayer(teamState, playerId, { eligible: next }));
  };

  const toggleIr = () => {
    if (!rosterPlayer) return;
    updateTeam((teamState) => updatePlayer(teamState, playerId, { injuredReserve: !rosterPlayer.injuredReserve }));
  };

  return { addToMyTeam, remove, markTaken, toggleEligible, toggleIr };
}
