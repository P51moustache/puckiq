/**
 * Tests for Insight Generator Service
 */

import type { Insight } from '../../types/insights';
import type { H2HRecord, TeamPlayerStats, PlayerStatLine, GameResult } from '../../types/gameResults';
import { generateInsights } from '../insightGenerator';

// ── Mock Data Factories ──────────────────────────────────────────────────────

function makeGame(id: number, home: string, away: string) {
  return { id, homeTeam: { abbrev: home }, awayTeam: { abbrev: away } };
}

function makeStandingsEntry(
  abbrev: string,
  streakCode: string,
  goalFor: number,
  goalAgainst: number,
  gamesPlayed: number
) {
  return {
    teamAbbrev: { default: abbrev },
    streakCode,
    goalFor,
    goalAgainst,
    gamesPlayed,
  };
}

function makeH2HRecord(
  teamA: string,
  teamB: string,
  teamAWins: number,
  teamBWins: number,
  otLosses = 0
): H2HRecord {
  return { teamA, teamB, teamAWins, teamBWins, otLosses, games: [{} as GameResult] };
}

function makeSkater(
  firstName: string,
  lastName: string,
  points: number,
  gamesPlayed: number
): PlayerStatLine {
  return {
    playerId: Math.floor(Math.random() * 100000),
    firstName,
    lastName,
    positionCode: 'C',
    gamesPlayed,
    goals: Math.floor(points * 0.4),
    assists: Math.floor(points * 0.6),
    points,
    plusMinus: 10,
    shots: 120,
    shootingPctg: 0.12,
  };
}

// ── Shared Fixtures ─────────────────────────────────────────────────────────

const mockGames = [
  makeGame(1, 'BOS', 'NYR'),
  makeGame(2, 'TOR', 'MTL'),
];

const mockStandings = {
  standings: [
    makeStandingsEntry('BOS', 'W5', 150, 100, 50),
    makeStandingsEntry('NYR', 'L2', 120, 130, 50),
    makeStandingsEntry('TOR', 'W3', 140, 120, 50),
    makeStandingsEntry('MTL', 'L4', 90, 140, 50),
  ],
};

const h2hMap = new Map<string, H2HRecord>([
  ['NYR-BOS', makeH2HRecord('NYR', 'BOS', 0, 3)],
]);

const playerStatsMap = new Map<string, TeamPlayerStats>([
  ['BOS', { skaters: [makeSkater('David', 'Pastrnak', 65, 45)], goalies: [] }],
  ['TOR', { skaters: [makeSkater('Auston', 'Matthews', 55, 48)], goalies: [] }],
]);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateInsights', () => {
  // ── 1. Happy path — all categories ──────────────────────────────────────

  describe('happy path - all categories', () => {
    it('generates insights from every category when full data is provided', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap, playerStatsMap);

      expect(insights.length).toBeGreaterThan(0);

      const categories = new Set(insights.map((i) => i.category));
      expect(categories.has('h2h')).toBe(true);
      expect(categories.has('streak')).toBe(true);
      expect(categories.has('player')).toBe(true);
      expect(categories.has('standings')).toBe(true);
    });
  });

  // ── 2. Empty inputs ────────────────────────────────────────────────────

  describe('empty inputs', () => {
    it('returns [] when games array is empty', () => {
      const result = generateInsights([], mockStandings, h2hMap, playerStatsMap);
      expect(result).toEqual([]);
    });

    it('returns [] when games is null', () => {
      const result = generateInsights(null as any, mockStandings, h2hMap, playerStatsMap);
      expect(result).toEqual([]);
    });

    it('returns [] when games is undefined', () => {
      const result = generateInsights(undefined as any, mockStandings, h2hMap, playerStatsMap);
      expect(result).toEqual([]);
    });
  });

  // ── 3. Partial data ───────────────────────────────────────────────────

  describe('partial data', () => {
    it('generates streak/player/standings insights when h2hMap is empty', () => {
      const emptyH2H = new Map<string, H2HRecord>();
      const insights = generateInsights(mockGames, mockStandings, emptyH2H, playerStatsMap);

      expect(insights.length).toBeGreaterThan(0);

      const categories = new Set(insights.map((i) => i.category));
      expect(categories.has('h2h')).toBe(false);
      expect(categories.has('streak')).toBe(true);
      expect(categories.has('player')).toBe(true);
      expect(categories.has('standings')).toBe(true);
    });

    it('generates only h2h insights when standings is null', () => {
      const insights = generateInsights(mockGames, null, h2hMap);

      const categories = new Set(insights.map((i) => i.category));
      // H2H does not depend on standings
      expect(categories.has('h2h')).toBe(true);
      // Streak and standings depend on standings data
      expect(categories.has('streak')).toBe(false);
      expect(categories.has('standings')).toBe(false);
    });

    it('generates h2h + streak + standings when playerStatsMap is omitted', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap);

      const categories = new Set(insights.map((i) => i.category));
      expect(categories.has('h2h')).toBe(true);
      expect(categories.has('streak')).toBe(true);
      expect(categories.has('standings')).toBe(true);
      expect(categories.has('player')).toBe(false);
    });
  });

  // ── 4. H2H insight generation ─────────────────────────────────────────

  describe('H2H insight generation', () => {
    it('generates insight when win differential is >= 2', () => {
      const map = new Map<string, H2HRecord>([
        ['NYR-BOS', makeH2HRecord('NYR', 'BOS', 0, 3)],
      ]);
      const insights = generateInsights(mockGames, mockStandings, map);
      const h2hInsights = insights.filter((i) => i.category === 'h2h');

      expect(h2hInsights.length).toBe(1);
      expect(h2hInsights[0].text).toContain('BOS leads season series 3-0 vs NYR');
      expect(h2hInsights[0].teamAbbrev).toBe('BOS');
    });

    it('does NOT generate insight when win differential is < 2', () => {
      const map = new Map<string, H2HRecord>([
        ['NYR-BOS', makeH2HRecord('NYR', 'BOS', 2, 3)],
      ]);
      const insights = generateInsights(mockGames, mockStandings, map);
      const h2hInsights = insights.filter((i) => i.category === 'h2h');

      expect(h2hInsights.length).toBe(0);
    });

    it('shows correct leader name when teamA leads', () => {
      const map = new Map<string, H2HRecord>([
        ['TOR-MTL', makeH2HRecord('TOR', 'MTL', 4, 1)],
      ]);
      const insights = generateInsights(mockGames, mockStandings, map);
      const h2hInsights = insights.filter((i) => i.category === 'h2h');

      expect(h2hInsights.length).toBe(1);
      expect(h2hInsights[0].text).toContain('TOR leads season series 4-1 vs MTL');
      expect(h2hInsights[0].teamAbbrev).toBe('TOR');
    });

    it('shows correct leader name when teamB leads', () => {
      const map = new Map<string, H2HRecord>([
        ['MTL-TOR', makeH2HRecord('MTL', 'TOR', 0, 4)],
      ]);
      const insights = generateInsights(mockGames, mockStandings, map);
      const h2hInsights = insights.filter((i) => i.category === 'h2h');

      expect(h2hInsights.length).toBe(1);
      expect(h2hInsights[0].text).toContain('TOR leads season series 4-0 vs MTL');
      expect(h2hInsights[0].teamAbbrev).toBe('TOR');
    });
  });

  // ── 5. Streak insights ────────────────────────────────────────────────

  describe('streak insights', () => {
    it('generates insight for streaks of 3+ games', () => {
      const standings = {
        standings: [makeStandingsEntry('BOS', 'W5', 150, 100, 50)],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights.length).toBe(1);
      expect(streakInsights[0].text).toBe('BOS on 5-game win streak');
    });

    it('does NOT generate insight for streaks of < 3 games', () => {
      const standings = {
        standings: [makeStandingsEntry('NYR', 'L2', 120, 130, 50)],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights.length).toBe(0);
    });

    it('handles W streakCode format correctly', () => {
      const standings = {
        standings: [makeStandingsEntry('TOR', 'W3', 140, 120, 50)],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights[0].text).toBe('TOR on 3-game win streak');
    });

    it('handles L streakCode format correctly', () => {
      const standings = {
        standings: [makeStandingsEntry('MTL', 'L4', 90, 140, 50)],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights[0].text).toBe('MTL on 4-game losing streak');
    });

    it('handles OT streakCode format correctly', () => {
      const standings = {
        standings: [makeStandingsEntry('NYR', 'OT3', 100, 110, 50)],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights[0].text).toBe('NYR on 3-game OT loss streak');
    });

    it('handles standings as a raw array (not wrapped in .standings)', () => {
      const rawArray = [makeStandingsEntry('BOS', 'W5', 150, 100, 50)];
      const insights = generateInsights(mockGames, rawArray, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights.length).toBe(1);
      expect(streakInsights[0].text).toBe('BOS on 5-game win streak');
    });

    it('filters out teams not playing today', () => {
      const standings = {
        standings: [
          makeStandingsEntry('BOS', 'W5', 150, 100, 50),
          makeStandingsEntry('EDM', 'W4', 130, 100, 50), // not in mockGames
          makeStandingsEntry('VGK', 'L3', 110, 130, 50), // not in mockGames
        ],
      };
      const insights = generateInsights(mockGames, standings, new Map());
      const streakInsights = insights.filter((i) => i.category === 'streak');

      expect(streakInsights.length).toBe(1);
      expect(streakInsights[0].teamAbbrev).toBe('BOS');
    });
  });

  // ── 6. Player insights ────────────────────────────────────────────────

  describe('player insights', () => {
    it('includes top scorer from teams playing today', () => {
      const insights = generateInsights(mockGames, mockStandings, new Map(), playerStatsMap);
      const playerInsights = insights.filter((i) => i.category === 'player');

      expect(playerInsights.length).toBeGreaterThan(0);

      const texts = playerInsights.map((i) => i.text);
      // David Pastrnak has most points (65), should appear first
      expect(texts[0]).toContain('David Pastrnak');
      expect(texts[0]).toContain('65 pts');
      expect(texts[0]).toContain('45 GP');
    });

    it('only includes teams playing today', () => {
      const statsWithExtraTeam = new Map<string, TeamPlayerStats>([
        ['BOS', { skaters: [makeSkater('David', 'Pastrnak', 65, 45)], goalies: [] }],
        // EDM is NOT in mockGames, so should be excluded
        ['EDM', { skaters: [makeSkater('Connor', 'McDavid', 90, 50)], goalies: [] }],
      ]);

      const insights = generateInsights(mockGames, mockStandings, new Map(), statsWithExtraTeam);
      const playerInsights = insights.filter((i) => i.category === 'player');

      const abbrevs = playerInsights.map((i) => i.teamAbbrev);
      expect(abbrevs).not.toContain('EDM');
    });

    it('sorts by points descending and takes top 2', () => {
      const threeTeamGames = [
        makeGame(1, 'BOS', 'NYR'),
        makeGame(2, 'TOR', 'MTL'),
        makeGame(3, 'FLA', 'TBL'),
      ];
      const bigStats = new Map<string, TeamPlayerStats>([
        ['BOS', { skaters: [makeSkater('David', 'Pastrnak', 65, 45)], goalies: [] }],
        ['TOR', { skaters: [makeSkater('Auston', 'Matthews', 55, 48)], goalies: [] }],
        ['FLA', { skaters: [makeSkater('Aleksander', 'Barkov', 50, 50)], goalies: [] }],
      ]);
      const insights = generateInsights(threeTeamGames, mockStandings, new Map(), bigStats);
      const playerInsights = insights.filter((i) => i.category === 'player');

      // Only top 2 scorers returned
      expect(playerInsights.length).toBeLessThanOrEqual(2);
      expect(playerInsights[0].text).toContain('David Pastrnak');
      if (playerInsights.length > 1) {
        expect(playerInsights[1].text).toContain('Auston Matthews');
      }
    });
  });

  // ── 7. Standings insights ─────────────────────────────────────────────

  describe('standings insights', () => {
    it('includes teams with extreme goal differential', () => {
      const insights = generateInsights(mockGames, mockStandings, new Map());
      const standingsInsights = insights.filter((i) => i.category === 'standings');

      expect(standingsInsights.length).toBeGreaterThan(0);

      // BOS has (150-100)/50 = 1.0 diff per game, MTL has (90-140)/50 = -1.0
      // Both should be sorted to top by absolute value
      const abbrevs = standingsInsights.map((i) => i.teamAbbrev);
      expect(abbrevs).toContain('BOS');
      expect(abbrevs).toContain('MTL');
    });

    it('only includes teams playing today', () => {
      const standingsWithExtra = {
        standings: [
          ...mockStandings.standings,
          makeStandingsEntry('EDM', 'W10', 200, 100, 50),
        ],
      };
      // EDM not in mockGames
      const insights = generateInsights(mockGames, standingsWithExtra, new Map());
      const standingsInsights = insights.filter((i) => i.category === 'standings');

      const abbrevs = standingsInsights.map((i) => i.teamAbbrev);
      expect(abbrevs).not.toContain('EDM');
    });

    it('shows "outscoring opponents" for positive goal diff', () => {
      const insights = generateInsights(mockGames, mockStandings, new Map());
      const bosInsight = insights.find(
        (i) => i.category === 'standings' && i.teamAbbrev === 'BOS'
      );

      expect(bosInsight).toBeDefined();
      expect(bosInsight!.text).toContain('outscoring opponents');
      expect(bosInsight!.text).toContain('1.0 goals/game');
    });

    it('shows "outscored by opponents" for negative goal diff', () => {
      const insights = generateInsights(mockGames, mockStandings, new Map());
      const mtlInsight = insights.find(
        (i) => i.category === 'standings' && i.teamAbbrev === 'MTL'
      );

      expect(mtlInsight).toBeDefined();
      expect(mtlInsight!.text).toContain('outscored by opponents');
      expect(mtlInsight!.text).toContain('1.0 goals/game');
    });

    it('returns at most 3 standings insights', () => {
      const manyTeamGames = [
        makeGame(1, 'BOS', 'NYR'),
        makeGame(2, 'TOR', 'MTL'),
        makeGame(3, 'FLA', 'TBL'),
      ];
      const bigStandings = {
        standings: [
          makeStandingsEntry('BOS', 'W5', 150, 100, 50),
          makeStandingsEntry('NYR', 'L2', 120, 130, 50),
          makeStandingsEntry('TOR', 'W3', 140, 120, 50),
          makeStandingsEntry('MTL', 'L4', 90, 140, 50),
          makeStandingsEntry('FLA', 'W2', 160, 90, 50),
          makeStandingsEntry('TBL', 'L1', 80, 150, 50),
        ],
      };
      const insights = generateInsights(manyTeamGames, bigStandings, new Map());
      const standingsInsights = insights.filter((i) => i.category === 'standings');

      expect(standingsInsights.length).toBeLessThanOrEqual(3);
    });
  });

  // ── 8. Insight cap ────────────────────────────────────────────────────

  describe('insight cap', () => {
    it('returns at most 10 insights even with lots of data', () => {
      // Create many games and corresponding standings/H2H to generate many insights
      const manyGames = [];
      const bigStandingsArr = [];
      const bigH2H = new Map<string, H2HRecord>();
      const bigPlayerStats = new Map<string, TeamPlayerStats>();

      const teams = ['BOS', 'NYR', 'TOR', 'MTL', 'FLA', 'TBL', 'WSH', 'PIT', 'CAR', 'NJD', 'PHI', 'CBJ'];

      for (let i = 0; i < teams.length; i += 2) {
        const home = teams[i];
        const away = teams[i + 1];
        manyGames.push(makeGame(i, home, away));

        // Each pair has big H2H differential
        bigH2H.set(`${home}-${away}`, makeH2HRecord(home, away, 5, 0));

        // Each team has a big streak
        bigStandingsArr.push(makeStandingsEntry(home, 'W5', 200, 100, 50));
        bigStandingsArr.push(makeStandingsEntry(away, 'L5', 80, 160, 50));

        // Each team has player stats
        bigPlayerStats.set(home, {
          skaters: [makeSkater('Player', `${home}`, 70, 50)],
          goalies: [],
        });
        bigPlayerStats.set(away, {
          skaters: [makeSkater('Player', `${away}`, 60, 50)],
          goalies: [],
        });
      }

      const bigStandings = { standings: bigStandingsArr };
      const insights = generateInsights(manyGames, bigStandings, bigH2H, bigPlayerStats);

      expect(insights.length).toBeLessThanOrEqual(10);
    });
  });

  // ── 9. Insight structure ──────────────────────────────────────────────

  describe('insight structure', () => {
    it('each insight has id, text, teamAbbrev, category, and shareText', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap, playerStatsMap);

      expect(insights.length).toBeGreaterThan(0);

      for (const insight of insights) {
        expect(insight).toHaveProperty('id');
        expect(typeof insight.id).toBe('string');

        expect(insight).toHaveProperty('text');
        expect(typeof insight.text).toBe('string');

        expect(insight).toHaveProperty('teamAbbrev');
        expect(typeof insight.teamAbbrev).toBe('string');

        expect(insight).toHaveProperty('category');
        expect(['h2h', 'streak', 'rest', 'player', 'standings']).toContain(insight.category);

        expect(insight).toHaveProperty('shareText');
        expect(typeof insight.shareText).toBe('string');
      }
    });

    it('shareText ends with " — PuckIQ"', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap, playerStatsMap);

      for (const insight of insights) {
        expect(insight.shareText).toMatch(/ — PuckIQ$/);
      }
    });

    it('shareText starts with the same text as the insight text', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap, playerStatsMap);

      for (const insight of insights) {
        expect(insight.shareText).toBe(`${insight.text} — PuckIQ`);
      }
    });

    it('insight ids are prefixed with their category', () => {
      const insights = generateInsights(mockGames, mockStandings, h2hMap, playerStatsMap);

      for (const insight of insights) {
        expect(insight.id).toMatch(new RegExp(`^${insight.category}-\\d+$`));
      }
    });
  });
});
