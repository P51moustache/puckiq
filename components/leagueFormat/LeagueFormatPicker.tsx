/**
 * "How does your league score?" — points or categories, and which categories. Shared by setup
 * and League settings, so both ask the same question the same way.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CategoryKey, LeagueFormat } from '../../types/fantasy';
import { CATEGORIES, type CategoryDef } from '../../services/fantasy/categories';
import { colors } from '../coach/ui';

const FORMATS: { value: LeagueFormat; label: string }[] = [
  { value: 'points', label: 'Points' },
  { value: 'categories', label: 'Categories' },
];

export function LeagueFormatPicker({ format, onChange }: { format: LeagueFormat; onChange: (format: LeagueFormat) => void }) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {FORMATS.map((option) => {
        const on = option.value === format;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            testID={`league-format-${option.value}`}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Toggle the categories a league counts. At least one always stays on. */
export function CategoryPicker({ categories, onChange }: { categories: CategoryKey[]; onChange: (categories: CategoryKey[]) => void }) {
  const counted = new Set(categories);
  const toggle = (key: CategoryKey) => {
    if (counted.has(key) && counted.size === 1) return;
    const next = new Set(counted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Catalog order, so the tallies always read the way the host app lists them.
    onChange(CATEGORIES.filter((category) => next.has(category.key)).map((category) => category.key));
  };
  const group = (title: string, defs: CategoryDef[]) => (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.grid}>
        {defs.map((category) => {
          const on = counted.has(category.key);
          return (
            <Pressable
              key={category.key}
              onPress={() => toggle(category.key)}
              style={[styles.cat, on && styles.catOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={category.label}
              testID={`category-${category.key}`}
            >
              <Text style={[styles.catText, on && styles.catTextOn]}>{category.short}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  return (
    <View style={styles.picker}>
      {group('SKATERS', CATEGORIES.filter((category) => !category.goalie))}
      {group('GOALIES', CATEGORIES.filter((category) => category.goalie))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.sub },
  chipTextOn: { color: colors.onInk },
  picker: { gap: 12 },
  group: { gap: 6 },
  groupTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cat: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.raised,
    alignItems: 'center',
  },
  catOn: { backgroundColor: colors.ink },
  catText: { fontSize: 13, fontWeight: '900', color: colors.sub, fontVariant: ['tabular-nums'] },
  catTextOn: { color: colors.onInk },
});
