/**
 * RosterBuilder — add names to the one roster. Local only.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { barn, barnLines } from '../constants/barn';
import { nhlHitToPlayer, saveRoster, updateRoster } from '../services/fantasyRoster';
import type { FantasyPlayer, FantasyRoster, NhlSearchPlayer } from '../types/fantasy';
import type { LineGroup } from '../types/lines';
import NhlPlayerSearch from './NhlPlayerSearch';

interface RosterBuilderProps {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  existingRoster?: FantasyRoster | null;
}

export default function RosterBuilder({
  visible,
  onDismiss,
  onSaved,
  existingRoster,
}: RosterBuilderProps) {
  const [addedPlayers, setAddedPlayers] = useState<FantasyPlayer[]>(
    existingRoster?.players ?? [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAddedPlayers(existingRoster?.players ?? []);
    }
  }, [visible, existingRoster]);

  const handleAddHit = useCallback((hit: NhlSearchPlayer, group: LineGroup) => {
    const duplicate = addedPlayers.some((player) => player.playerId === hit.playerId);
    if (duplicate) {
      Alert.alert('On the board', `${hit.name} is already listed.`);
      return;
    }
    setAddedPlayers((prev) => [...prev, nhlHitToPlayer(hit)]);
  }, [addedPlayers]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    setAddedPlayers((prev) => prev.filter((player) => player.playerId !== playerId));
  }, []);

  const handleSave = useCallback(async () => {
    if (addedPlayers.length === 0) return;
    setSaving(true);
    try {
      if (existingRoster) {
        await updateRoster({
          ...existingRoster,
          players: addedPlayers,
        });
      } else {
        await saveRoster({
          name: 'My Team',
          scoringFormat: 'yahoo',
          players: addedPlayers,
        });
      }
      onSaved();
    } catch (error) {
      console.warn('[ROSTER_BUILDER] Error saving roster:', error);
    } finally {
      setSaving(false);
    }
  }, [addedPlayers, existingRoster, onSaved]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
      testID="roster-builder-modal"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} testID="roster-builder-cancel">
            <Text style={styles.cancelText}>Leave it</Text>
          </TouchableOpacity>
          <Text style={styles.title}>The board</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={addedPlayers.length === 0 || saving}
            testID="roster-builder-save"
          >
            <Text
              style={[
                styles.saveText,
                (addedPlayers.length === 0 || saving) && styles.saveTextDisabled,
              ]}
            >
              {saving ? barnLines.loading : 'Stick it'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{barnLines.emptyBoard}</Text>

        <NhlPlayerSearch
          onAdd={handleAddHit}
          alreadyOnRoster={new Set(addedPlayers.map((player) => player.playerId))}
        />

        {addedPlayers.length > 0 && (
          <View style={styles.chipsContainer} testID="added-players-chips">
            {addedPlayers.map((player) => (
              <TouchableOpacity
                key={player.playerId}
                style={styles.chip}
                onPress={() => handleRemovePlayer(player.playerId)}
                testID={`chip-${player.playerId}`}
              >
                <Text style={styles.chipText}>
                  {player.playerName}
                  {player.position ? ` · ${player.position}` : ''}
                </Text>
                <Ionicons name="close" size={12} color={barn.ink} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: barn.ground,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: barn.rule,
  },
  cancelText: {
    fontSize: 14,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    fontFamily: barn.fonts.mono,
    color: barn.ink,
    textTransform: 'uppercase',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: barn.signal,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  saveTextDisabled: {
    color: barn.ghost,
  },
  hint: {
    fontSize: 16,
    color: barn.ink,
    fontFamily: barn.fonts.body,
    paddingTop: 24,
    paddingBottom: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: barn.ink,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    color: barn.ink,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
});
