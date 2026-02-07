/**
 * Model Factor Definitions
 * Documents each factor from CONFIDENCE_WEIGHTS and PLAYER_WEIGHTS
 * Used by the model builder UI to display and edit factor weights
 */

import type { ConfidenceWeights, PlayerWeights } from '../types/predictions';

/**
 * Category types for grouping factors in the UI
 */
export type FactorCategory = 'team' | 'situational' | 'specialTeams' | 'playerBased';

/**
 * Definition for a single prediction factor
 */
export interface FactorDefinition {
  key: keyof ConfidenceWeights | keyof PlayerWeights;
  name: string;
  description: string;
  category: FactorCategory;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  higherIsBetter: boolean;  // true = higher weight means more impact, false = it's a penalty
}

/**
 * All factor definitions matching CONFIDENCE_WEIGHTS and PLAYER_WEIGHTS
 * from utils/predictionUtils.ts
 */
export const FACTOR_DEFINITIONS: FactorDefinition[] = [
  // ============================================
  // Team-Based Factors
  // ============================================
  {
    key: 'standingsDifferential',
    name: 'Standings Differential',
    description: 'Impact of point percentage difference between teams. A 0.2 point% difference (e.g., .600 vs .400) multiplied by this weight adds to the confidence score.',
    category: 'team',
    defaultValue: 80,
    min: 0,
    max: 150,
    step: 5,
    higherIsBetter: true,
  },
  {
    key: 'homeIceAdvantage',
    name: 'Home Ice Advantage',
    description: 'Fixed bonus points added for the home team. NHL home teams win ~54% of games historically.',
    category: 'team',
    defaultValue: 8,
    min: 0,
    max: 20,
    step: 1,
    higherIsBetter: true,
  },
  {
    key: 'streakImpact',
    name: 'Streak Impact',
    description: 'Impact of current win/loss streaks. Uses diminishing returns scaling (W5 = +3.6, L3 = -2.4). Captures team momentum.',
    category: 'team',
    defaultValue: 12,
    min: 0,
    max: 30,
    step: 1,
    higherIsBetter: true,
  },
  {
    key: 'goalDifferentialImpact',
    name: 'Goal Differential',
    description: 'Impact of goal differential per game. Teams that outscore opponents consistently tend to be stronger.',
    category: 'team',
    defaultValue: 12,
    min: 0,
    max: 30,
    step: 1,
    higherIsBetter: true,
  },
  {
    key: 'recentFormImpact',
    name: 'Recent Form',
    description: 'Impact of recent performance (last 5-10 games). Captures hot/cold streaks and current team form rather than season-long stats.',
    category: 'team',
    defaultValue: 40,
    min: 0,
    max: 80,
    step: 5,
    higherIsBetter: true,
  },

  // ============================================
  // Situational Factors
  // ============================================
  {
    key: 'backToBackPenalty',
    name: 'Back-to-Back Penalty',
    description: 'Penalty applied when a team is playing their second game in two nights. Fatigued teams historically perform worse.',
    category: 'situational',
    defaultValue: 15,
    min: 0,
    max: 30,
    step: 1,
    higherIsBetter: true,  // Higher penalty = more impact on fatigued teams
  },
  {
    key: 'restAdvantage',
    name: 'Rest Advantage',
    description: 'Bonus per extra rest day compared to opponent (capped at ±3 days). Well-rested teams have an edge.',
    category: 'situational',
    defaultValue: 8,
    min: 0,
    max: 20,
    step: 1,
    higherIsBetter: true,
  },

  // ============================================
  // Special Teams Factors
  // ============================================
  {
    key: 'specialTeamsImpact',
    name: 'Special Teams',
    description: 'Impact of power play and penalty kill percentage differential. Combines PP% and PK% into single strength metric.',
    category: 'specialTeams',
    defaultValue: 25,
    min: 0,
    max: 50,
    step: 5,
    higherIsBetter: true,
  },
  {
    key: 'shotDifferentialImpact',
    name: 'Shot Differential',
    description: 'Impact of net shots per game (shots for minus shots against). Teams that control possession tend to win more.',
    category: 'specialTeams',
    defaultValue: 10,
    min: 0,
    max: 30,
    step: 1,
    higherIsBetter: true,
  },

  // ============================================
  // Player-Based Factors
  // ============================================
  {
    key: 'goalieMatchupImpact',
    name: 'Goalie Matchup',
    description: 'Multiplier for starting goalie comparison impact. Compares save percentage, GAA, and recent form between starters.',
    category: 'playerBased',
    defaultValue: 1.0,
    min: 0,
    max: 3.0,
    step: 0.1,
    higherIsBetter: true,
  },
  {
    key: 'hotPlayersImpact',
    name: 'Hot/Cold Players',
    description: 'Multiplier for team hot/cold player differential. Considers players on scoring streaks or in slumps.',
    category: 'playerBased',
    defaultValue: 1.5,
    min: 0,
    max: 3.0,
    step: 0.1,
    higherIsBetter: true,
  },
];

/**
 * Get factors by category
 */
export function getFactorsByCategory(category: FactorCategory): FactorDefinition[] {
  return FACTOR_DEFINITIONS.filter(f => f.category === category);
}

/**
 * Get a specific factor definition by key
 */
export function getFactorByKey(key: string): FactorDefinition | undefined {
  return FACTOR_DEFINITIONS.find(f => f.key === key);
}

/**
 * Category display names for UI
 */
export const CATEGORY_NAMES: Record<FactorCategory, string> = {
  team: 'Team Performance',
  situational: 'Situational',
  specialTeams: 'Special Teams',
  playerBased: 'Player-Based',
};

/**
 * Category descriptions for UI tooltips
 */
export const CATEGORY_DESCRIPTIONS: Record<FactorCategory, string> = {
  team: 'Core team statistics like standings, streaks, and recent form',
  situational: 'Game-day factors like rest days and back-to-back scheduling',
  specialTeams: 'Power play, penalty kill, and shot metrics',
  playerBased: 'Individual player performance factors like goalie matchups',
};
