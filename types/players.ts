/**
 * Types for the Players tab — re-exports from services + additional types
 * for player search and player detail (Phases 2-3).
 */

// Re-export all player types from the service for convenience
export type {
  SkaterCategory,
  GoalieCategory,
  SkaterPosition,
  SkaterLeader,
  GoalieLeader,
  PlayerSearchResult,
  RosterPlayer,
} from '../services/playerLeaders';

// Re-export player detail types
export type {
  PlayerBio,
  SkaterSeasonStats,
  GoalieSeasonStats,
  PlayerCareer,
  PlayerEdgeStats,
  RecentGame,
  HotColdData,
  PaceProjections,
  RollingStats,
  AdvancedTrends,
  GoalieTrends,
  SkaterTrends,
  PlayerDetail,
} from '../services/playerDetail';
