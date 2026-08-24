/**
 * RosterBuilder — add names to the one roster. Local only. No Yahoo/ESPN, no Pro.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { saveRoster, updateRoster } from '../services/fantasyRoster';
import type { FantasyPlayer, FantasyRoster } from '../types/fantasy';

interface RosterBuilderProps {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  existingRoster?: FantasyRoster | null;
}

type LocalPosition = 'F' | 'D' | 'G';

function makeLocalPlayer(name: string, position: LocalPosition): FantasyPlayer {
  return {
    playerId: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    playerName: name.trim(),
    teamAbbrev: '',
    position,
    rosterPosition: 'BN',
  };
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
  const [name, setName] = useState('');
  const [position, setPosition] = useState<LocalPosition>('F');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAddedPlayers(existingRoster?.players ?? []);
      setName('');
      setPosition('F');
    }
  }, [visible, existingRoster]);

  const handleAdd = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      return;
    }
    const duplicate = addedPlayers.some(
      (player) => player.playerName.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      Alert.alert('Already on the roster', `${trimmed} is already listed.`);
      return;
    }
    setAddedPlayers((prev) => [...prev, makeLocalPlayer(trimmed, position)]);
    setName('');
  }, [addedPlayers, name, position]);

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
          scoringFormat: existingRoster?.scoringFormat ?? 'yahoo',
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
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {existingRoster ? 'Edit Roster' : 'Build Roster'}
          </Text>
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
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Add the names on your roster. No NHL search, no extra teams.
        </Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.nameInput}
            placeholder="Player name"
            placeholderTextColor={rinkGlass.textMuted}
            value={name}
            onChangeText={setName}
            testID="roster-name-input"
            autoCorrect={false}
            autoCapitalize="words"
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
        </View>

        <View style={styles.positionRow} testID="roster-position-chips">
          {(['F', 'D', 'G'] as LocalPosition[]).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.positionChip, position === item && styles.positionChipActive]}
              onPress={() => setPosition(item)}
              testID={`roster-position-${item}`}
            >
              <Text style={[styles.positionText, position === item && styles.positionTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.addButton, name.trim().length < 1 && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={name.trim().length < 1}
            testID="roster-add-player"
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

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
                <Ionicons name="close-circle" size={14} color={rinkGlass.textSecondary} />
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
    backgroundColor: rinkGlass.ice,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rinkGlass.glassBorder,
  },
  cancelText: {
    fontSize: 16,
    color: rinkGlass.textSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  hint: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addRow: {
    paddingHorizontal: 16,
  },
  nameInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    fontSize: 15,
    color: rinkGlass.textPrimary,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  positionChip: {
    width: 44,
    height: 40,
    borderRadius: 8,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionChipActive: {
    backgroundColor: rinkGlass.blueLight,
    borderColor: rinkGlass.blueLight,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
  positionTextActive: {
    color: '#0a0e1a',
  },
  addButton: {
    marginLeft: 'auto',
    backgroundColor: rinkGlass.blueLight,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.zamboni,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
  },
});
