/**
 * A realistic 16-man roster so a new user (or App Review) can see every screen
 * before typing their own team. Ids are NHL player ids; teams as of 2026-09.
 */

import type { FantasyPlayer } from '../types/fantasy';

type Row = [number, string, string, string];

const ROWS: Row[] = [
  [8478402, 'Connor McDavid', 'EDM', 'C'],
  [8476453, 'Nikita Kucherov', 'TBL', 'R'],
  [8480801, 'Brady Tkachuk', 'FLA', 'L'],
  [8478864, 'Kirill Kaprizov', 'MIN', 'L'],
  [8481559, 'Jack Hughes', 'NJD', 'C'],
  [8477939, 'William Nylander', 'TOR', 'R'],
  [8476460, 'Mark Scheifele', 'WPG', 'C'],
  [8482116, 'Tim Stützle', 'OTT', 'C'],
  [8477946, 'Dylan Larkin', 'DET', 'C'],
  [8480069, 'Cale Makar', 'COL', 'D'],
  [8480803, 'Evan Bouchard', 'EDM', 'D'],
  [8480839, 'Rasmus Dahlin', 'BUF', 'D'],
  [8480800, 'Quinn Hughes', 'MIN', 'D'],
  [8481542, 'Moritz Seider', 'DET', 'D'],
  [8478048, 'Igor Shesterkin', 'NYR', 'G'],
  [8479979, 'Jake Oettinger', 'DAL', 'G'],
];

export const SAMPLE_TEAM_NAME = 'Sample Team';

export const SAMPLE_PLAYERS: FantasyPlayer[] = ROWS.map(([playerId, playerName, teamAbbrev, position]) => ({
  playerId,
  playerName,
  teamAbbrev,
  position,
  rosterPosition: 'BN',
}));
