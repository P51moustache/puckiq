import catalog from './arenaTeamPalettes.json';

export interface ArenaPalette {
  hero: string;
  heroInk: string;
  action: string;
  actionInk: string;
  frame: string;
  frameInk: string;
  page: string;
  paper: string;
  soft: string;
  edge: string;
  ink: string;
  muted: string;
  link: string;
  focus: string;
}

export interface ArenaTeam {
  abbrev: string;
  name: string;
  shortName: string;
  tokens: ArenaPalette;
}

const NEUTRAL_ARENA_PALETTE: ArenaPalette = {
  hero: '#26364D',
  heroInk: '#FFFFFF',
  action: '#4CC9F0',
  actionInk: '#111820',
  frame: '#172332',
  frameInk: '#FFFFFF',
  page: '#F7F9FC',
  paper: '#FFFFFF',
  soft: '#E8EEF5',
  edge: '#C8D3E0',
  ink: '#172332',
  muted: '#4C5A6B',
  link: '#146C85',
  focus: '#146C85',
};

export const ARENA_TEAMS: readonly ArenaTeam[] = catalog.teams;

const teamsByAbbrev = new Map(
  ARENA_TEAMS.map((team) => [team.abbrev, team] as const)
);

export function getArenaTeam(abbrev: string): ArenaTeam | null {
  return teamsByAbbrev.get(abbrev.toUpperCase()) ?? null;
}

export function getArenaPalette(abbrev?: string | null): ArenaPalette {
  return abbrev ? getArenaTeam(abbrev)?.tokens ?? NEUTRAL_ARENA_PALETTE : NEUTRAL_ARENA_PALETTE;
}
