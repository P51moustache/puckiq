/**
 * A category league's night on carbon: one cell per counted category, skaters on the first row
 * and goalies on the second — the matchup grid the host app shows, for just your night.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { categoryDef } from '../../services/fantasy/categories';
import type { CategoryTally } from '../../services/fantasy/nightTallies';
import { colors, display } from '../coach/ui';

/** Six cells fit a phone row at the hero's numeral size; every row shares the columns, like a timing grid. */
const CELLS_PER_ROW = 6;
const CELL_BASIS = `${100 / CELLS_PER_ROW}%` as const;

export function CategoryTallies({ tallies, size = 26, testID }: { tallies: CategoryTally[]; size?: number; testID?: string }) {
  const skaters = tallies.filter((tally) => !categoryDef(tally.key).goalie);
  const goalies = tallies.filter((tally) => categoryDef(tally.key).goalie);
  return (
    <View style={styles.grid} testID={testID}>
      {[skaters, goalies].filter((row) => row.length > 0).map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((tally) => (
            <View
              key={tally.key}
              style={styles.cell}
              accessible
              accessibilityLabel={`${categoryDef(tally.key).label}: ${tally.text}`}
              testID={testID ? `${testID}-${tally.key}` : undefined}
            >
              <Text style={[display(tally.text.length > 3 ? size - 6 : size), styles.value]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {tally.text}
              </Text>
              <Text style={styles.label}>{tally.short}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  cell: { flexBasis: CELL_BASIS, flexGrow: 0, flexShrink: 0, paddingRight: 6 },
  value: { color: colors.onInk },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.onInkSub, marginTop: 2 },
});
