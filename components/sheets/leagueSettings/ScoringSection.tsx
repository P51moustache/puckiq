/**
 * League settings → Scoring: points or categories. A points league edits its per-stat points;
 * a category league picks the categories it counts, and PuckIQ weighs them evenly.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CategoryKey, FantasyPlatform, LeagueFormat, ScoringWeights } from '../../../types/fantasy';
import { SCORING_FIELDS, scoringPresetFor } from '../../../services/fantasy/scoring';
import { YAHOO_DEFAULT_CATEGORIES } from '../../../services/fantasy/categories';
import { Card, colors, SectionLabel } from '../../coach/ui';
import { CategoryPicker, LeagueFormatPicker } from '../../leagueFormat/LeagueFormatPicker';
import { Stepper } from './Stepper';

/** Per-stat points stay sane: a negative goal or a 20-point hit is a typo. */
const MIN_POINTS = -10;
const MAX_POINTS = 20;
/** Volume stats move in tenths; the rest in halves. */
const FINE_STEP_FIELDS: (keyof ScoringWeights)[] = ['saves', 'shots', 'hits', 'blocks'];

export interface ScoringSectionProps {
  platform: FantasyPlatform;
  format: LeagueFormat;
  onFormat: (format: LeagueFormat) => void;
  categories: CategoryKey[];
  onCategories: (categories: CategoryKey[]) => void;
  scoring: ScoringWeights;
  onScoring: (scoring: ScoringWeights) => void;
}

export function ScoringSection({ platform, format, onFormat, categories, onCategories, scoring, onScoring }: ScoringSectionProps) {
  const yahoo = platform === 'yahoo';
  const reset = () => (format === 'categories' ? onCategories([...YAHOO_DEFAULT_CATEGORIES]) : onScoring(scoringPresetFor(platform)));
  return (
    <>
      <SectionLabel
        title="Scoring"
        right={(
          <Pressable onPress={reset} hitSlop={8} accessibilityLabel={yahoo ? 'Reset to Yahoo defaults' : 'Reset scoring'} testID="scoring-reset">
            <Text style={styles.reset}>{yahoo ? 'Yahoo defaults' : 'Reset'}</Text>
          </Pressable>
        )}
      />
      <Card style={styles.card}>
        <LeagueFormatPicker format={format} onChange={onFormat} />
        {format === 'categories' ? (
          <>
            <Text style={styles.footnote}>
              The categories your league counts. PuckIQ weighs them evenly when it ranks players, and Tonight shows your
              night category by category. Faceoffs, penalty minutes and game-winning goals aren’t tracked yet.
            </Text>
            <CategoryPicker categories={categories} onChange={onCategories} />
          </>
        ) : (
          <>
            <Text style={styles.footnote}>Points per stat, as your league scores them.</Text>
            {SCORING_FIELDS.map((field) => (
              <View key={field.key} style={styles.row}>
                <Text style={styles.rowLabel}>{field.label}</Text>
                <Stepper
                  value={scoring[field.key]}
                  min={MIN_POINTS}
                  max={MAX_POINTS}
                  step={FINE_STEP_FIELDS.includes(field.key) ? 0.1 : 0.5}
                  format={(value) => (Number.isInteger(value) ? String(value) : value.toFixed(1))}
                  onChange={(value) => onScoring({ ...scoring, [field.key]: value })}
                />
              </View>
            ))}
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  reset: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
});
