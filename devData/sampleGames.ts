/**
 * Dev-only sample games data for populating the Tonight screen during development.
 * Shaped like the NHL API /v1/score/{date} response.
 * Use require() in consumer code so this is tree-shaken from production builds.
 */

export interface SampleTeam {
  id: number;
  abbrev: string;
  score?: number;
  record?: string;
  streakCode?: string;
}

export interface SampleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: 'FUT' | 'LIVE' | 'FINAL' | 'OFF';
  homeTeam: SampleTeam;
  awayTeam: SampleTeam;
  period?: number;
  clock?: { timeRemaining: string; running?: boolean };
}

export interface SampleGamesResponse {
  games: SampleGame[];
}

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export const sampleGamesResponse: SampleGamesResponse = {
  games: [
    // FUT — TOR @ BOS, 7:00 PM ET
    {
      id: 2025020801,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T00:00:00Z`, // placeholder
      gameState: 'FUT',
      awayTeam: {
        id: 10,
        abbrev: 'TOR',
        record: '32-18-5',
        streakCode: 'W4',
      },
      homeTeam: {
        id: 6,
        abbrev: 'BOS',
        record: '29-20-6',
        streakCode: 'L1',
      },
    },
    // LIVE — COL @ DAL, P2 8:34 remaining
    {
      id: 2025020802,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T01:00:00Z`,
      gameState: 'LIVE',
      awayTeam: {
        id: 21,
        abbrev: 'COL',
        score: 2,
        record: '34-15-4',
        streakCode: 'L2',
      },
      homeTeam: {
        id: 25,
        abbrev: 'DAL',
        score: 1,
        record: '30-19-5',
      },
      period: 2,
      clock: { timeRemaining: '08:34', running: true },
    },
    // FUT — NYR @ PIT, 7:30 PM ET
    {
      id: 2025020803,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T00:30:00Z`,
      gameState: 'FUT',
      awayTeam: {
        id: 3,
        abbrev: 'NYR',
        record: '28-22-4',
      },
      homeTeam: {
        id: 5,
        abbrev: 'PIT',
        record: '25-23-7',
        streakCode: 'W2',
      },
    },
    // FUT — EDM @ VGK, 10:00 PM ET
    {
      id: 2025020804,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T03:00:00Z`,
      gameState: 'FUT',
      awayTeam: {
        id: 22,
        abbrev: 'EDM',
        record: '35-14-5',
        streakCode: 'W3',
      },
      homeTeam: {
        id: 54,
        abbrev: 'VGK',
        record: '31-17-6',
      },
    },
    // FINAL — MTL @ OTT, 3-2
    {
      id: 2025020805,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T00:00:00Z`,
      gameState: 'FINAL',
      awayTeam: {
        id: 8,
        abbrev: 'MTL',
        score: 3,
        record: '22-28-5',
      },
      homeTeam: {
        id: 9,
        abbrev: 'OTT',
        score: 2,
        record: '24-25-6',
        streakCode: 'L3',
      },
    },
    // FUT — FLA @ CAR, 7:00 PM ET
    {
      id: 2025020806,
      season: 20252026,
      gameType: 2,
      gameDate: todayStr,
      startTimeUTC: `${todayStr}T00:00:00Z`,
      gameState: 'FUT',
      awayTeam: {
        id: 13,
        abbrev: 'FLA',
        record: '33-16-5',
        streakCode: 'W2',
      },
      homeTeam: {
        id: 12,
        abbrev: 'CAR',
        record: '34-14-4',
      },
    },
  ],
};
