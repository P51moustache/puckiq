import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

type PlatformChoice = 'yahoo' | 'espn' | 'browsing';

interface PlatformPickerProps {
  onSelect: (choice: PlatformChoice) => void;
}

const PLATFORMS: { id: PlatformChoice; label: string; accent: string }[] = [
  { id: 'yahoo', label: 'Yahoo Fantasy', accent: '#7c3aed' },
  { id: 'espn', label: 'ESPN Fantasy', accent: '#ef4444' },
  { id: 'browsing', label: 'Just browsing', accent: theme.subtext },
];

export function PlatformPicker({ onSelect }: PlatformPickerProps) {
  const [selected, setSelected] = useState<PlatformChoice | null>(null);

  const handleSelect = (choice: PlatformChoice) => {
    setSelected(choice);
    onSelect(choice);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What fantasy platform do you use?</Text>
      </View>

      <View style={styles.cards}>
        {PLATFORMS.map((platform) => {
          const isSelected = selected === platform.id;
          return (
            <TouchableOpacity
              key={platform.id}
              style={[
                styles.card,
                { borderColor: isSelected ? platform.accent : theme.card },
                isSelected && { backgroundColor: theme.card },
              ]}
              onPress={() => handleSelect(platform.id)}
              accessibilityLabel={platform.label}
            >
              <View style={[styles.indicator, { backgroundColor: platform.accent }]} />
              <Text style={[styles.cardLabel, isSelected && { color: theme.text }]}>
                {platform.label}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
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
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 36,
  },
  cards: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.subtle,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.card,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.subtext,
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    color: theme.accent,
    fontWeight: '700',
  },
});
