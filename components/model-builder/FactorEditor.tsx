import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FACTOR_DEFINITIONS,
  FactorCategory,
  getFactorsByCategory,
  CATEGORY_NAMES,
  CATEGORY_DESCRIPTIONS,
} from '../../constants/modelFactors';
import type { ConfidenceWeights, PlayerWeights } from '../../types/predictions';
import WeightSlider from './WeightSlider';
import { useArena } from '../arena/ArenaProvider';
import type { ArenaPalette } from '../../constants/arenaTheme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

interface FactorEditorProps {
  weights: AllWeights;
  onChange: (weights: AllWeights) => void;
  onSliderDragStart?: () => void;
  onSliderDragEnd?: () => void;
}

// Categories in display order
const CATEGORIES: FactorCategory[] = ['team', 'situational', 'specialTeams', 'playerBased'];

// Category colors for the distribution chart
export default function FactorEditor({
  weights,
  onChange,
  onSliderDragStart,
  onSliderDragEnd,
}: FactorEditorProps) {
  const { palette: p } = useArena();
  const styles = useMemo(() => createStyles(p), [p]);
  const categoryColors: Record<FactorCategory, string> = useMemo(() => ({
    team: p.action,
    situational: p.hero,
    specialTeams: p.frame,
    playerBased: p.muted,
  }), [p]);
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Record<FactorCategory, boolean>>({
    team: true,
    situational: true,
    specialTeams: true,
    playerBased: true,
  });

  // Convert weights to Record for easier access
  const weightsRecord = useMemo((): Record<string, number> => {
    const record: Record<string, number> = {};
    (Object.keys(weights) as (keyof AllWeights)[]).forEach((key) => {
      record[key] = weights[key];
    });
    return record;
  }, [weights]);

  // Calculate weight totals per category for distribution chart
  const categoryTotals = useMemo(() => {
    const totals: Record<FactorCategory, number> = {
      team: 0,
      situational: 0,
      specialTeams: 0,
      playerBased: 0,
    };

    FACTOR_DEFINITIONS.forEach((factor) => {
      const value = weightsRecord[factor.key] ?? factor.defaultValue;
      // Normalize: for factors with small values (like playerBased 0-3), scale up
      const normalizedValue = factor.max <= 5 ? value * 20 : value;
      totals[factor.category] += normalizedValue;
    });

    return totals;
  }, [weightsRecord]);

  // Calculate total for percentage calculation
  const totalWeight = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  }, [categoryTotals]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: FactorCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  // Handle single weight change
  const handleWeightChange = useCallback(
    (key: string, value: number) => {
      const newWeights = {
        ...weights,
        [key]: value,
      } as AllWeights;
      onChange(newWeights);
    },
    [weights, onChange]
  );

  // Reset category to defaults
  const resetCategory = useCallback(
    (category: FactorCategory) => {
      const factors = getFactorsByCategory(category);
      const newWeights = { ...weights };

      factors.forEach((factor) => {
        const key = factor.key as keyof AllWeights;
        (newWeights[key] as number) = factor.defaultValue;
      });

      onChange(newWeights);
    },
    [weights, onChange]
  );

  // Reset all to defaults
  const resetAll = useCallback(() => {
    const newWeights: AllWeights = {
      standingsDifferential: 80,
      homeIceAdvantage: 8,
      streakImpact: 12,
      goalDifferentialImpact: 12,
      recentFormImpact: 40,
      backToBackPenalty: 15,
      restAdvantage: 8,
      specialTeamsImpact: 25,
      shotDifferentialImpact: 10,
      goalieMatchupImpact: 1.0,
      hotPlayersImpact: 1.5,
    };
    // Apply defaults from FACTOR_DEFINITIONS
    FACTOR_DEFINITIONS.forEach((factor) => {
      const key = factor.key as keyof AllWeights;
      (newWeights[key] as number) = factor.defaultValue;
    });
    onChange(newWeights);
  }, [onChange]);

  // Check if category has modifications
  const categoryHasModifications = useCallback(
    (category: FactorCategory): boolean => {
      const factors = getFactorsByCategory(category);
      return factors.some(
        (factor) => weightsRecord[factor.key] !== factor.defaultValue
      );
    },
    [weightsRecord]
  );

  // Check if any modifications exist
  const hasAnyModifications = useMemo(() => {
    return FACTOR_DEFINITIONS.some(
      (factor) => weightsRecord[factor.key] !== factor.defaultValue
    );
  }, [weightsRecord]);

  // Render weight distribution chart (horizontal stacked bar)
  const renderDistributionChart = () => {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weight Distribution</Text>
        <View style={styles.chartBar}>
          {CATEGORIES.map((category, index) => {
            const percentage = totalWeight > 0 ? (categoryTotals[category] / totalWeight) * 100 : 25;
            const isFirst = index === 0;
            const isLast = index === CATEGORIES.length - 1;

            return (
              <View
                key={category}
                style={[
                  styles.chartSegment,
                  {
                    flex: percentage,
                    backgroundColor: categoryColors[category],
                    borderTopLeftRadius: isFirst ? 6 : 0,
                    borderBottomLeftRadius: isFirst ? 6 : 0,
                    borderTopRightRadius: isLast ? 6 : 0,
                    borderBottomRightRadius: isLast ? 6 : 0,
                  },
                ]}
              >
              </View>
            );
          })}
        </View>
        {/* Legend */}
        <View style={styles.legendContainer}>
          {CATEGORIES.map((category) => (
            <View key={category} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: categoryColors[category] }]}
              />
              <Text style={styles.legendText}>
                {CATEGORY_NAMES[category].split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render a category section
  const renderCategorySection = (category: FactorCategory) => {
    const factors = getFactorsByCategory(category);
    const isExpanded = expandedCategories[category];
    const hasModifications = categoryHasModifications(category);

    return (
      <View key={category} style={styles.categoryContainer}>
        {/* Category Header */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${CATEGORY_NAMES[category]}, ${isExpanded ? 'expanded' : 'collapsed'}`}
          accessibilityState={{ expanded: isExpanded }}
        >
          <View style={styles.categoryHeaderLeft}>
            <View
              style={[styles.categoryIndicator, { backgroundColor: categoryColors[category] }]}
            />
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color={p.action}
            />
            <Text style={styles.categoryTitle}>{CATEGORY_NAMES[category]}</Text>
          </View>
          <View style={styles.categoryHeaderRight}>
            {hasModifications && (
              <TouchableOpacity
                style={styles.resetCategoryButton}
                onPress={(e) => {
                  e.stopPropagation();
                  resetCategory(category);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Reset ${CATEGORY_NAMES[category]} weights`}
              >
                <Text style={styles.resetCategoryText}>Reset</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.factorCount}>{factors.length}</Text>
          </View>
        </TouchableOpacity>

        {/* Category Description (collapsed) */}
        {!isExpanded && (
          <Text style={styles.categoryDescriptionCollapsed}>
            {CATEGORY_DESCRIPTIONS[category]}
          </Text>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.categoryContent}>
            {factors.map((factor) => (
              <WeightSlider
                key={factor.key}
                factorKey={factor.key}
                label={factor.name}
                description={factor.description}
                value={weightsRecord[factor.key] ?? factor.defaultValue}
                min={factor.min}
                max={factor.max}
                step={factor.step}
                defaultValue={factor.defaultValue}
                onChange={(value) => handleWeightChange(factor.key, value)}
                onDragStart={onSliderDragStart}
                onDragEnd={onSliderDragEnd}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.contentContainer}>
      {/* Weight Distribution Chart */}
      {renderDistributionChart()}

      {/* Global Reset Button */}
      <View style={styles.globalResetContainer}>
        <TouchableOpacity
          style={[
            styles.globalResetButton,
            !hasAnyModifications && styles.globalResetButtonDisabled,
          ]}
          onPress={resetAll}
          disabled={!hasAnyModifications}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reset all weights to defaults"
          accessibilityState={{ disabled: !hasAnyModifications }}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={hasAnyModifications ? p.actionInk : p.muted}
          />
          <Text
            style={[
              styles.globalResetText,
              !hasAnyModifications && styles.globalResetTextDisabled,
            ]}
          >
            Reset All to Defaults
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Sections */}
      {CATEGORIES.map(renderCategorySection)}
    </View>
  );
}

const createStyles = (p: ArenaPalette) => StyleSheet.create({
  contentContainer: {
    padding: 16,
  },
  // Distribution Chart Styles
  chartContainer: {
    backgroundColor: p.paper,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: p.ink,
    marginBottom: 12,
  },
  chartBar: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartSegmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: p.muted,
  },
  // Global Reset Styles
  globalResetContainer: {
    marginBottom: 16,
  },
  globalResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: p.paper,
    paddingVertical: 12,
    borderRadius: 10,
  },
  globalResetButtonDisabled: {
    opacity: 0.5,
  },
  globalResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: p.ink,
  },
  globalResetTextDisabled: {
    color: p.muted,
  },
  // Category Section Styles
  categoryContainer: {
    backgroundColor: p.paper,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: p.soft,
    minHeight: 48,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  categoryIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: p.ink,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetCategoryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: p.soft,
    borderRadius: 6,
  },
  resetCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: p.link,
  },
  factorCount: {
    fontSize: 13,
    color: p.muted,
    backgroundColor: p.soft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  categoryDescriptionCollapsed: {
    fontSize: 12,
    color: p.muted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontStyle: 'italic',
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
});
