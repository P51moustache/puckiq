/** Insight type for InsightFeed analytical nuggets */

/**
 * Insight categories.
 * - Legacy game-day categories (h2h, streak, rest, player, standings, edge) come
 *   from services/insightGenerator.ts and power the Today screen's INTEL feed.
 * - Finder categories (trend, regression, goalie, matchup, special-teams,
 *   situational) come from services/insightFinder.ts and power the Insights tab.
 */
export type InsightCategory =
  | 'h2h'
  | 'streak'
  | 'rest'
  | 'player'
  | 'standings'
  | 'edge'
  | 'trend'
  | 'regression'
  | 'goalie'
  | 'matchup'
  | 'special-teams'
  | 'situational';

/**
 * How deep the user wants to go.
 * 1 = Simple   (clear, obvious signals — streaks, who's hot)
 * 2 = Standard (adds regression cautions, slumps, sustainability)
 * 3 = Advanced (adds possession/PDO-driven, lower-signal nuance)
 */
export type InsightDepth = 1 | 2 | 3;

/** A supporting number shown under an insight (the receipts). */
export interface InsightMetric {
  label: string;
  value: string;
  /** Optional comparison/context, e.g. "vs 9.1% season". */
  context?: string;
}

export interface Insight {
  id: string;
  text: string;
  teamAbbrev?: string;
  category: InsightCategory;
  sentiment: 'positive' | 'negative' | 'neutral';
  shareText: string;

  // --- Insight-finder fields (optional; legacy game-day insights omit these) ---
  /** Minimum depth tier at which this insight is shown. */
  depth?: InsightDepth;
  /** Plain-language "why this matters" explanation. */
  detail?: string;
  /** Supporting numbers. */
  metrics?: InsightMetric[];
  /** Player this insight is about, if any. */
  playerId?: number;
  /** Ranking score — higher is more notable. Used to sort the feed. */
  severity?: number;
}
