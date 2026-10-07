/**
 * League Room services — the public API. Screens and hooks import from here, not from the
 * individual modules. See docs/plans/2026-10-06-season-two.md §2 for the backend contract.
 */

export {
  createLeagueApi,
  createRoom,
  DEFAULT_ROOM_NAME,
  fetchRoomSnapshot,
  joinRoom,
  leaveRoom,
  react,
  REACTIONS_FETCH_LIMIT,
  removeMember,
  rotateRoomCode,
  setDuesPaid,
  updateMembership,
  updateRoom,
  type CreateRoomOptions,
  type LeagueApi,
} from './api';
export { supabaseLeagueBackend, type BackendResult, type LeagueApiDeps, type LeagueBackend, type LeagueTable, type SelectQuery } from './backend';
export {
  roomCoverage,
  rosterAgeHours,
  STALE_ROSTER_HOURS,
  staleMembers,
  takenPlayerIds,
  type RoomCoverage,
} from './availability';
export { boardGameIds, buildRoomBoard, type RoomBoardInput, type RoomBoardRow } from './board';
export {
  codeFromLink,
  INVITE_DEEP_LINK_BASE,
  INVITE_PAGE_URL,
  inviteDeepLink,
  inviteMessage,
  inviteUrl,
  isValidRoomCode,
  normalizeRoomCode,
} from './codes';
export {
  duesProblemMessage,
  formatAmount,
  isHttpsLink,
  isIsoDate,
  MAX_DUES_AMOUNT,
  summarizeDues,
  validateDues,
  type DuesProblem,
  type DuesSummary,
  type DuesValidation,
} from './dues';
export {
  isLeagueError,
  isLeagueUnavailable,
  LEAGUE_ERROR_CODES,
  LeagueError,
  leagueErrorMessage,
  toLeagueError,
  type LeagueErrorCode,
} from './errors';
export { fromRoomDues, toRoom, toRoomDues, toRoomDuesStatus, toRoomMember, toRoomReaction, type RoomDuesJson } from './mappers';
export { byTeamName, myMember, otherMembers } from './members';
export {
  cleanRoomText,
  FALLBACK_TEAM_NAME,
  roomTeamName,
  roomTextMessage,
  type RoomTextProblem,
  type RoomTextResult,
} from './moderation';
export { opponentChoices, roomOpponent, type RoomOpponent } from './opponent';
export { UNIFORM_VALUE, uniformValues, uniformWeekPlan, type UniformPlanInput } from './plans';
export { buildRoomWeekRecap, type RecapAward, type RecapMember, type RoomWeekRecap, type RoomWeekRecapInput } from './recap';
export { ROOM_ROSTER_MAX, rosterForUpload, sanitizeRoster, sanitizeRosterPlayer } from './roster';
export { ROSTER_PUSH_DEBOUNCE_MS, ROSTER_REFRESH_HOURS, rosterNeedsPush } from './sync';
export { compareTradeIdeas, DEFAULT_MIN_TRADE_GAIN, DEFAULT_TRADE_LIMIT, findTrades, type TradeIdea, type TradeInput } from './trades';
