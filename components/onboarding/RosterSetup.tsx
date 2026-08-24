import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { theme } from '../../constants/theme';

interface PlayerResult {
  id: number;
  name: string;
  teamAbbrev: string;
  position: string;
}

interface RosterSetupProps {
  onContinue: (players: PlayerResult[]) => void;
  onSkip: () => void;
}

type LocalPosition = 'F' | 'D' | 'G';

export function RosterSetup({ onContinue, onSkip }: RosterSetupProps) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<LocalPosition>('F');
  const [addedPlayers, setAddedPlayers] = useState<PlayerResult[]>([]);

  const addPlayer = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    if (addedPlayers.some((player) => player.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setAddedPlayers((prev) => [
      ...prev,
      {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        name: trimmed,
        teamAbbrev: '',
        position,
      },
    ]);
    setName('');
  }, [addedPlayers, name, position]);

  const removePlayer = useCallback((playerId: number) => {
    setAddedPlayers((prev) => prev.filter((player) => player.id !== playerId));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add your roster</Text>
        <Text style={styles.subtitle}>
          One roster. You’ll tap these names into F, D, G, or bench on this week’s lines.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Player name"
        placeholderTextColor={theme.subtext}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
        onSubmitEditing={addPlayer}
        returnKeyType="done"
      />

      <View style={styles.positionRow}>
        {(['F', 'D', 'G'] as LocalPosition[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.positionChip, position === item && styles.positionChipActive]}
            onPress={() => setPosition(item)}
            accessibilityLabel={`Position ${item}`}
          >
            <Text style={[styles.positionText, position === item && styles.positionTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.addButton, name.trim().length < 1 && styles.addButtonDisabled]}
          onPress={addPlayer}
          disabled={name.trim().length < 1}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {addedPlayers.length > 0 && (
        <View style={styles.chips}>
          {addedPlayers.map((player) => (
            <TouchableOpacity
              key={player.id}
              style={styles.chip}
              onPress={() => removePlayer(player.id)}
              accessibilityLabel={`Remove ${player.name}`}
            >
              <Text style={styles.chipText}>
                {player.name} · {player.position}
              </Text>
              <Text style={styles.chipClose}>x</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            addedPlayers.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={() => onContinue(addedPlayers)}
          disabled={addedPlayers.length === 0}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip — I’ll do this later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    lineHeight: 22,
  },
  searchInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.subtle,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  positionChip: {
    width: 44,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.subtle,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  positionText: {
    color: theme.subtext,
    fontWeight: '700',
  },
  positionTextActive: {
    color: '#0a0e1a',
  },
  addButton: {
    marginLeft: 'auto',
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: '#0a0e1a',
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.factbox,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  chipText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipClose: {
    color: theme.subtext,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 24,
    gap: 12,
  },
  continueButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: theme.subtext,
    fontSize: 15,
  },
});
