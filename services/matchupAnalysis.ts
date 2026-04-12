/**
 * Matchup Analysis Service
 *
 * Compares two fantasy rosters category-by-category using player projections.
 * Identifies close categories and recommends lineup adjustments.
 */

import { getProjectionsForRoster } from './fantasyProjections';
import type { PlayerProjection, ScoringFormat } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryResult {
  category: string;
  myTotal: number;
  oppTotal: number;
  edge: 'winning' | 'losing' | 'close';
  swingPlayers?: string[];
}

export interface MatchupResult {
  categories: CategoryResult[];
  myWins: number;
  oppWins: number;
  closeCategories: number;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  label: string;
  key: keyof PlayerProjection;
}

const CATEGORIES: CategoryDef[] = [
  { label: 'Goals', key: 'predGoals' },
  { label: 'Assists', key: 'predAssists' },
  { label: 'SOG', key: 'predSog' },
  { label: 'Hits', key: 'predHits' },
  { label: 'Blocks', key: 'predBlocks' },
];

const CLOSE_THRESHOLD = 0.10; // within 10% is considered "close"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumCategory(projections: PlayerProjection[], key: keyof PlayerProjection): number {
  return projections.reduce((sum, p) => sum + (Number(p[key]) || 0), 0);
}

function determineEdge(myTotal: number, oppTotal: number): 'winning' | 'losing' | 'close' {
  if (myTotal === 0 && oppTotal === 0) return 'close';
  const max = Math.max(myTotal, oppTotal);
  if (max === 0) return 'close';
  const diff = Math.abs(myTotal - oppTotal) / max;
  if (diff <= CLOSE_THRESHOLD) return 'close';
  return myTotal > oppTotal ? 'winning' : 'losing';
}

/**
 * Find bench players from myProjections who could swing a close/losing category.
 * A "bench player" is anyone not in the starting set but in the full projection list.
 * For simplicity, we return the top contributors for the given stat key.
 */
function findSwingPlayers(
  myProjections: PlayerProjection[],
  key: keyof PlayerProjection,
  limit: number = 2,
): string[] {
  return [...myProjections]
    .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))
    .slice(0, limit)
    .filter(p => (Number(p[key]) || 0) > 0)
    .map(p => p.playerName);
}

function generateRecommendation(categories: CategoryResult[]): string {
  const closeLosing = categories.filter(c => c.edge === 'close' || c.edge === 'losing');

  if (closeLosing.length === 0) {
    return 'You are projected to win most categories. Maintain your current lineup.';
  }

  // Find the closest category where we are losing or close
  const closest = closeLosing.sort((a, b) => {
    const diffA = Math.abs(a.myTotal - a.oppTotal);
    const diffB = Math.abs(b.myTotal - b.oppTotal);
    return diffA - diffB;
  })[0];

  if (closest.swingPlayers && closest.swingPlayers.length > 0) {
    return `Focus on ${closest.category} \u2014 ${closest.swingPlayers[0]} can help swing this category.`;
  }

  return `Focus on ${closest.category} \u2014 look for streaming options to close the gap.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeMatchup(
  myPlayerIds: number[],
  oppPlayerIds: number[],
  format: ScoringFormat,
  gameDate: string,
): Promise<MatchupResult> {
  if (myPlayerIds.length === 0 && oppPlayerIds.length === 0) {
    return {
      categories: CATEGORIES.map(c => ({
        category: c.label,
        myTotal: 0,
        oppTotal: 0,
        edge: 'close' as const,
      })),
      myWins: 0,
      oppWins: 0,
      closeCategories: CATEGORIES.length,
      recommendation: 'Add players to both rosters to see matchup analysis.',
    };
  }

  // Fetch projections for both rosters in parallel
  const [myProjections, oppProjections] = await Promise.all([
    getProjectionsForRoster(myPlayerIds, format, gameDate),
    getProjectionsForRoster(oppPlayerIds, format, gameDate),
  ]);

  const categories: CategoryResult[] = CATEGORIES.map(({ label, key }) => {
    const myTotal = sumCategory(myProjections, key);
    const oppTotal = sumCategory(oppProjections, key);
    const edge = determineEdge(myTotal, oppTotal);

    const result: CategoryResult = {
      category: label,
      myTotal: Math.round(myTotal * 100) / 100,
      oppTotal: Math.round(oppTotal * 100) / 100,
      edge,
    };

    // Add swing players for close or losing categories
    if (edge !== 'winning' && myProjections.length > 0) {
      result.swingPlayers = findSwingPlayers(myProjections, key);
    }

    return result;
  });

  const myWins = categories.filter(c => c.edge === 'winning').length;
  const oppWins = categories.filter(c => c.edge === 'losing').length;
  const closeCategories = categories.filter(c => c.edge === 'close').length;

  return {
    categories,
    myWins,
    oppWins,
    closeCategories,
    recommendation: generateRecommendation(categories),
  };
}

// Export for testing
export { CATEGORIES, CLOSE_THRESHOLD, sumCategory, determineEdge, findSwingPlayers, generateRecommendation };
