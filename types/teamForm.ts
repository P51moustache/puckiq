/**
 * Types for team recent form / win-loss sparkline data.
 */

export interface TeamFormData {
  teamAbbrev: string;
  /** Last 10 completed game results, most recent first. */
  results: ('W' | 'L' | 'OTL')[];
  wins: number;
  losses: number;
  otLosses: number;
  /** Current streak string, e.g. "W3", "L2", "OTL1". */
  streak: string;
}
