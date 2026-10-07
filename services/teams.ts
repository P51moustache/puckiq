/**
 * Fantasy teams on this device (one per league). Pure updaters + AsyncStorage persistence.
 * Migrates the single PuckIQ 2.x roster on first load and leaves the old key untouched.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  FantasyPlatform,
  FantasyPlayer,
  FantasyRoster,
  FantasyTeam,
  LineupSlots,
  SlotPosition,
  TeamsState,
} from '../types/fantasy';
import { sanitizeSlots, STANDARD_SLOTS } from './fantasy/lineup';
import { DEFAULT_SCORING, sanitizeScoring } from './fantasy/scoring';

export const TEAMS_STORAGE_KEY = 'puckiq_teams_v3';
export const LEGACY_ROSTER_KEY = 'puckiq_fantasy_roster';
export const LEGACY_OPPONENT_KEY = 'puckiq_opponent_roster';

export const DEFAULT_LEAGUE_SIZE = 12;
export const MIN_LEAGUE_SIZE = 4;
export const MAX_LEAGUE_SIZE = 20;

export const MAX_MIN_GOALIE_STARTS = 7;

export const FREE_TEAM_LIMIT = 1;
export const PRO_TEAM_LIMIT = 5;
export const MAX_ROSTER_PLAYERS = 30;

const PLATFORMS: FantasyPlatform[] = ['yahoo', 'espn', 'fantrax', 'other'];
const SLOT_POSITIONS: SlotPosition[] = ['C', 'LW', 'RW', 'D', 'G'];

export const PLATFORM_LABEL: Record<FantasyPlatform, string> = {
  yahoo: 'Yahoo',
  espn: 'ESPN',
  fantrax: 'Fantrax',
  other: 'Other',
};

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `team-${Date.now().toString(36)}-${idCounter}`;
}

export function emptyTeamsState(): TeamsState {
  return { activeTeamId: null, teams: [] };
}

export function sanitizeLeagueSize(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_LEAGUE_SIZE;
  return Math.max(MIN_LEAGUE_SIZE, Math.min(MAX_LEAGUE_SIZE, n));
}

export function sanitizeMinGoalieStarts(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_MIN_GOALIE_STARTS, n));
}

export function createTeam(input: {
  name?: string;
  platform?: FantasyPlatform;
  leagueSize?: number;
  slots?: LineupSlots;
  players?: FantasyPlayer[];
  now?: Date;
}): FantasyTeam {
  const stamp = (input.now ?? new Date()).toISOString();
  return {
    id: newId(),
    name: input.name?.trim() || 'My Team',
    platform: input.platform ?? 'yahoo',
    leagueSize: sanitizeLeagueSize(input.leagueSize),
    minGoalieStarts: 0,
    slots: sanitizeSlots(input.slots ?? STANDARD_SLOTS),
    scoring: { ...DEFAULT_SCORING },
    players: (input.players ?? []).slice(0, MAX_ROSTER_PLAYERS),
    opponentName: '',
    opponent: [],
    hiddenPickupIds: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

const ROSTER_POSITIONS: FantasyPlayer['rosterPosition'][] = ['C', 'LW', 'RW', 'D', 'G', 'BN', 'IR'];

/**
 * One player from untrusted JSON (storage, backup, a League Room), or null when it isn't a usable
 * player: a positive integer id and a name; team upper-cased; known eligibility only (deduped);
 * the IR flag only when true. The single sanitiser for every place a roster comes from.
 */
export function sanitizePlayer(raw: unknown): FantasyPlayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const playerId = Number(row.playerId);
  const playerName = typeof row.playerName === 'string' ? row.playerName.trim() : '';
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !playerName) return null;
  const eligible = Array.isArray(row.eligible)
    ? [...new Set((row.eligible as unknown[]).filter((pos): pos is SlotPosition => SLOT_POSITIONS.includes(pos as SlotPosition)))]
    : [];
  const rosterPosition = ROSTER_POSITIONS.includes(row.rosterPosition as FantasyPlayer['rosterPosition'])
    ? (row.rosterPosition as FantasyPlayer['rosterPosition'])
    : 'BN';
  return {
    playerId,
    playerName,
    teamAbbrev: typeof row.teamAbbrev === 'string' ? row.teamAbbrev.trim().toUpperCase() : '',
    position: typeof row.position === 'string' ? row.position : '',
    rosterPosition,
    ...(eligible.length > 0 ? { eligible } : {}),
    ...(row.injuredReserve === true ? { injuredReserve: true } : {}),
  };
}

function sanitizePlayers(raw: unknown): FantasyPlayer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: FantasyPlayer[] = [];
  for (const row of raw) {
    const player = sanitizePlayer(row);
    if (!player || seen.has(player.playerId)) continue;
    seen.add(player.playerId);
    out.push(player);
  }
  return out.slice(0, MAX_ROSTER_PLAYERS);
}

function sanitizeTeam(raw: any): FantasyTeam | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const stamp = new Date().toISOString();
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'My Team',
    platform: PLATFORMS.includes(raw.platform) ? raw.platform : 'other',
    leagueSize: sanitizeLeagueSize(raw.leagueSize ?? DEFAULT_LEAGUE_SIZE),
    minGoalieStarts: sanitizeMinGoalieStarts(raw.minGoalieStarts),
    slots: sanitizeSlots(raw.slots),
    scoring: sanitizeScoring(raw.scoring),
    players: sanitizePlayers(raw.players),
    opponentName: typeof raw.opponentName === 'string' ? raw.opponentName : '',
    opponent: sanitizePlayers(raw.opponent),
    ...(raw.opponentSource === 'room' || raw.opponentSource === 'manual' ? { opponentSource: raw.opponentSource } : {}),
    hiddenPickupIds: Array.isArray(raw.hiddenPickupIds)
      ? raw.hiddenPickupIds.map(Number).filter((id: number) => Number.isFinite(id) && id > 0)
      : [],
    ...(typeof raw.roomId === 'string' && raw.roomId ? { roomId: raw.roomId } : {}),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : stamp,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : stamp,
  };
}

export function parseTeamsState(raw: unknown): TeamsState {
  if (!raw || typeof raw !== 'object') return emptyTeamsState();
  const candidate = raw as Partial<TeamsState>;
  const teams = Array.isArray(candidate.teams)
    ? candidate.teams.map(sanitizeTeam).filter((team): team is FantasyTeam => team !== null)
    : [];
  const activeTeamId = teams.some((team) => team.id === candidate.activeTeamId)
    ? (candidate.activeTeamId as string)
    : teams[0]?.id ?? null;
  return { activeTeamId, teams };
}

/** PuckIQ 2.x kept one roster (+ an optional opponent list). Carry both forward. */
export function migrateLegacy(roster: FantasyRoster | null, opponent: FantasyPlayer[] | null): TeamsState | null {
  if (!roster && (!opponent || opponent.length === 0)) return null;
  const team = createTeam({
    name: roster?.name,
    platform: roster?.scoringFormat === 'espn' ? 'espn' : 'yahoo',
    players: sanitizePlayers(roster?.players ?? []),
  });
  team.opponent = sanitizePlayers(opponent ?? []);
  return { activeTeamId: team.id, teams: [team] };
}

export async function saveTeamsState(state: TeamsState): Promise<void> {
  await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(state));
}

export async function loadTeamsState(): Promise<TeamsState> {
  try {
    const raw = await AsyncStorage.getItem(TEAMS_STORAGE_KEY);
    if (raw) return parseTeamsState(JSON.parse(raw));

    const [legacyRoster, legacyOpponent] = await Promise.all([
      AsyncStorage.getItem(LEGACY_ROSTER_KEY),
      AsyncStorage.getItem(LEGACY_OPPONENT_KEY),
    ]);
    const migrated = migrateLegacy(
      legacyRoster ? (JSON.parse(legacyRoster) as FantasyRoster) : null,
      legacyOpponent ? (JSON.parse(legacyOpponent) as FantasyPlayer[]) : null,
    );
    if (migrated) {
      await saveTeamsState(migrated);
      return migrated;
    }
  } catch (error) {
    console.warn('[TEAMS] Could not load teams:', error);
  }
  return emptyTeamsState();
}

// ---------------------------------------------------------------------------
// Pure updaters
// ---------------------------------------------------------------------------

function touch(team: FantasyTeam, patch: Partial<FantasyTeam>): FantasyTeam {
  return { ...team, ...patch, updatedAt: new Date().toISOString() };
}

export function addPlayers(team: FantasyTeam, players: FantasyPlayer[], list: 'players' | 'opponent' = 'players'): FantasyTeam {
  const existing = team[list];
  const ids = new Set(existing.map((player) => player.playerId));
  const additions = players.filter((player) => {
    if (ids.has(player.playerId)) return false;
    ids.add(player.playerId);
    return true;
  });
  return touch(team, { [list]: [...existing, ...additions].slice(0, MAX_ROSTER_PLAYERS) } as Partial<FantasyTeam>);
}

export function removePlayer(team: FantasyTeam, playerId: number, list: 'players' | 'opponent' = 'players'): FantasyTeam {
  return touch(team, { [list]: team[list].filter((player) => player.playerId !== playerId) } as Partial<FantasyTeam>);
}

export function replacePlayer(team: FantasyTeam, oldId: number, next: FantasyPlayer): FantasyTeam {
  const players = team.players
    .filter((player) => player.playerId !== next.playerId || player.playerId === oldId)
    .map((player) => (player.playerId === oldId ? next : player));
  return touch(team, { players });
}

export function updatePlayer(team: FantasyTeam, playerId: number, patch: Partial<FantasyPlayer>): FantasyTeam {
  return touch(team, {
    players: team.players.map((player) => (player.playerId === playerId ? { ...player, ...patch, playerId } : player)),
  });
}

export function hidePickup(team: FantasyTeam, playerId: number): FantasyTeam {
  if (team.hiddenPickupIds.includes(playerId)) return team;
  return touch(team, { hiddenPickupIds: [...team.hiddenPickupIds, playerId] });
}

export function unhideAllPickups(team: FantasyTeam): FantasyTeam {
  return touch(team, { hiddenPickupIds: [] });
}

/** Link a team to a League Room (or unlink with null). Unlinking drops a room-synced opponent. */
export function setTeamRoom(team: FantasyTeam, roomId: string | null): FantasyTeam {
  if (roomId) return touch(team, { roomId });
  const { roomId: _dropped, ...rest } = team;
  const fromRoom = team.opponentSource === 'room';
  return touch(rest as FantasyTeam, fromRoom ? { opponent: [], opponentName: '', opponentSource: 'manual' } : {});
}

/**
 * Apply this week's opponent from the room. Skips the write when nothing changed, so a
 * polling room doesn't churn `updatedAt` (and cloud backup) every refresh.
 */
export function applyRoomOpponent(team: FantasyTeam, name: string, players: FantasyPlayer[]): FantasyTeam {
  const next = sanitizePlayers(players);
  const same =
    team.opponentSource === 'room' &&
    team.opponentName === name &&
    team.opponent.length === next.length &&
    team.opponent.every((player, index) => player.playerId === next[index]?.playerId && player.teamAbbrev === next[index]?.teamAbbrev);
  if (same) return team;
  return touch(team, { opponentName: name, opponent: next, opponentSource: 'room' });
}

export function upsertTeam(state: TeamsState, team: FantasyTeam): TeamsState {
  const exists = state.teams.some((row) => row.id === team.id);
  const teams = exists ? state.teams.map((row) => (row.id === team.id ? team : row)) : [...state.teams, team];
  return { activeTeamId: state.activeTeamId ?? team.id, teams };
}

export function deleteTeam(state: TeamsState, teamId: string): TeamsState {
  const teams = state.teams.filter((team) => team.id !== teamId);
  const activeTeamId = state.activeTeamId === teamId ? teams[0]?.id ?? null : state.activeTeamId;
  return { activeTeamId, teams };
}

export function activeTeamOf(state: TeamsState): FantasyTeam | null {
  return state.teams.find((team) => team.id === state.activeTeamId) ?? state.teams[0] ?? null;
}

export function teamLimit(isPro: boolean): number {
  return isPro ? PRO_TEAM_LIMIT : FREE_TEAM_LIMIT;
}
