/**
 * Tests for utils/headlineGenerator.ts
 * Covers: all headline types, priority ordering, character constraints, empty/missing data
 */

import { generateTonightHeadline } from '../headlineGenerator';
import type { H2HRecord } from '../../types/gameResults';
import type { MomentumData } from '../../types/edgeStats';

// --- Helpers ---

function makeGame(away: string, home: string, awayStreak?: string, homeStreak?: string) {
  return {
    homeTeam: { abbrev: home, streakCode: homeStreak },
    awayTeam: { abbrev: away, streakCode: awayStreak },
  };
}

function makeH2H(teamA: string, teamB: string, aWins: number, bWins: number, gamesCount?: number): H2HRecord {
  const total = gamesCount ?? (aWins + bWins);
  return {
    teamA,
    teamB,
    teamAWins: aWins,
    teamBWins: bWins,
    otLosses: 0,
    games: Array.from({ length: total }, (_, i) => ({
      id: i + 1,
      game_id: 2025020001 + i,
      season: '20252026',
      game_date: '2026-01-15',
      home_team: teamB,
      away_team: teamA,
      home_score: 3,
      away_score: 2,
      game_state: 'OFF',
      created_at: '2026-01-15T00:00:00Z',
    })),
  };
}

function makeMomentum(score: number): MomentumData {
  return {
    score,
    trend: score > 0 ? '↑' : score < 0 ? '↓' : '→',
    history: [score, score, score, score, score],
    label: score > 0 ? 'Hot' : score < 0 ? 'Cold' : 'Neutral',
  };
}

function makeStandings(teams: { abbrev: string; division: string; streakCode?: string }[]) {
  return {
    standings: teams.map((t) => ({
      teamAbbrev: { default: t.abbrev },
      divisionName: t.division,
      streakCode: t.streakCode,
    })),
  };
}

// --- Tests ---

describe('generateTonightHeadline', () => {
  describe('empty / missing data fallback', () => {
    it('returns "No Games Tonight" for empty games array', () => {
      expect(generateTonightHeadline([], null, new Map(), new Map(), new Map())).toBe('No Games Tonight');
    });

    it('returns "No Games Tonight" for null games', () => {
      expect(generateTonightHeadline(null as any, null, new Map(), new Map(), new Map())).toBe('No Games Tonight');
    });

    it('returns "No Games Tonight" for undefined games', () => {
      expect(generateTonightHeadline(undefined as any, null, new Map(), new Map(), new Map())).toBe('No Games Tonight');
    });

    it('returns default headline when no special conditions are met', () => {
      const games = [makeGame('TOR', 'MTL'), makeGame('BOS', 'NYR')];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).toBe('2 Games on the Slate Tonight');
    });
  });

  describe('rivalry headline (highest priority)', () => {
    it('triggers when H2H series is tied 1-1', () => {
      const games = [makeGame('TOR', 'MTL')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 1, 1)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('Rivalry Night');
      expect(result).toContain('TOR');
      expect(result).toContain('MTL');
      expect(result).toContain('1-1');
    });

    it('triggers when H2H series is tied 2-2', () => {
      const games = [makeGame('BOS', 'NYR')];
      const h2h = new Map([['BOS-NYR', makeH2H('BOS', 'NYR', 2, 2)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('Rivalry Night');
      expect(result).toContain('2-2');
    });

    it('does not trigger when series is not tied', () => {
      const games = [makeGame('TOR', 'MTL')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 2, 1)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).not.toContain('Rivalry Night');
    });

    it('does not trigger with fewer than 2 games played', () => {
      const games = [makeGame('TOR', 'MTL')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 0, 0, 1)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).not.toContain('Rivalry Night');
    });
  });

  describe('division showdown headline', () => {
    it('triggers when 3+ games are divisional matchups', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'OTT'),
        makeGame('DET', 'BUF'),
      ];
      const standings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic' },
        { abbrev: 'MTL', division: 'Atlantic' },
        { abbrev: 'BOS', division: 'Atlantic' },
        { abbrev: 'OTT', division: 'Atlantic' },
        { abbrev: 'DET', division: 'Atlantic' },
        { abbrev: 'BUF', division: 'Atlantic' },
      ]);
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      expect(result).toContain('Division Showdown');
      expect(result).toContain('3');
    });

    it('does not trigger with only 2 divisional matchups', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'OTT'),
        makeGame('COL', 'NYR'), // cross-division
      ];
      const standings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic' },
        { abbrev: 'MTL', division: 'Atlantic' },
        { abbrev: 'BOS', division: 'Atlantic' },
        { abbrev: 'OTT', division: 'Atlantic' },
        { abbrev: 'COL', division: 'Central' },
        { abbrev: 'NYR', division: 'Metropolitan' },
      ]);
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      expect(result).not.toContain('Division Showdown');
    });

    it('handles null standings gracefully', () => {
      const games = [makeGame('TOR', 'MTL')];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).not.toContain('Division Showdown');
    });
  });

  describe('revenge game headline', () => {
    it('triggers when one team leads 3-0', () => {
      const games = [makeGame('TOR', 'MTL')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 3, 0)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('Revenge Game');
      expect(result).toContain('MTL');
    });

    it('triggers when one team leads 3-1', () => {
      const games = [makeGame('BOS', 'NYR')];
      const h2h = new Map([['BOS-NYR', makeH2H('BOS', 'NYR', 3, 1)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('Revenge Game');
    });

    it('identifies the trailing team correctly (team B trailing)', () => {
      const games = [makeGame('TOR', 'MTL')];
      // TOR (teamA) leads 3-0, so MTL (teamB = home) wants revenge
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 3, 0)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('MTL');
      expect(result).toContain('Looks to Even');
    });

    it('identifies the trailing team correctly (team A trailing)', () => {
      const games = [makeGame('TOR', 'MTL')];
      // MTL (teamB) leads 3-0, so TOR (teamA = away) wants revenge
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 0, 3)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('TOR');
      expect(result).toContain('Looks to Even');
    });

    it('does not trigger with 2-1 lead (not lopsided enough)', () => {
      const games = [makeGame('TOR', 'MTL')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 2, 1)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).not.toContain('Revenge Game');
    });
  });

  describe('streak alert headline', () => {
    it('triggers for a 5-game win streak from standings', () => {
      const games = [makeGame('TOR', 'BOS')];
      const standings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic', streakCode: 'W5' },
        { abbrev: 'BOS', division: 'Atlantic', streakCode: 'L2' },
      ]);
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      expect(result).toContain('Streak Alert');
      expect(result).toContain('TOR');
      expect(result).toContain('5-Game Win Streak');
    });

    it('triggers for a 7-game losing streak from standings', () => {
      const games = [makeGame('MTL', 'OTT')];
      const standings = makeStandings([
        { abbrev: 'MTL', division: 'Atlantic', streakCode: 'L7' },
        { abbrev: 'OTT', division: 'Atlantic' },
      ]);
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      expect(result).toContain('Streak Alert');
      expect(result).toContain('MTL');
      expect(result).toContain('7-Game Losing Streak');
    });

    it('triggers from game object streakCode (sample data)', () => {
      const games = [makeGame('TOR', 'BOS', 'W6', undefined)];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).toContain('Streak Alert');
      expect(result).toContain('TOR');
      expect(result).toContain('6-Game Win Streak');
    });

    it('picks the longest streak when multiple teams are streaking', () => {
      const games = [makeGame('TOR', 'BOS', 'W5', 'W8')];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).toContain('BOS');
      expect(result).toContain('8-Game');
    });

    it('does not trigger for streaks under 5', () => {
      const games = [makeGame('TOR', 'BOS', 'W4', 'L3')];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).not.toContain('Streak Alert');
    });
  });

  describe('rest mismatch / fatigue factor headline', () => {
    it('triggers when 3+ teams are on back-to-backs', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'NYR'),
      ];
      const restMap = new Map([
        ['TOR', 0],
        ['MTL', 0],
        ['BOS', 0],
        ['NYR', 2],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), new Map(), restMap);
      expect(result).toContain('Fatigue Factor');
      expect(result).toContain('3');
      expect(result).toContain('Back-to-Backs');
    });

    it('does not trigger with only 2 teams on back-to-backs', () => {
      const games = [makeGame('TOR', 'MTL'), makeGame('BOS', 'NYR')];
      const restMap = new Map([
        ['TOR', 0],
        ['MTL', 0],
        ['BOS', 2],
        ['NYR', 2],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), new Map(), restMap);
      expect(result).not.toContain('Fatigue Factor');
    });

    it('counts rest <= 0 as back-to-back', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'NYR'),
      ];
      const restMap = new Map([
        ['TOR', -1],
        ['MTL', 0],
        ['BOS', 0],
        ['NYR', 1],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), new Map(), restMap);
      expect(result).toContain('Fatigue Factor');
      expect(result).toContain('3');
    });
  });

  describe('momentum watch headline', () => {
    it('triggers when momentum gap >= 8 between teams', () => {
      const games = [makeGame('TOR', 'MTL')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(7)],
        ['MTL', makeMomentum(-2)],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).toContain('Hot vs Cold');
      expect(result).toContain('TOR');
      expect(result).toContain('MTL');
    });

    it('identifies hot and cold teams correctly', () => {
      const games = [makeGame('TOR', 'MTL')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(-5)],
        ['MTL', makeMomentum(5)],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).toContain('Hot vs Cold');
      // MTL is hotter, should come first
      expect(result).toMatch(/MTL.*TOR/);
    });

    it('does not trigger with gap < 8', () => {
      const games = [makeGame('TOR', 'MTL')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(3)],
        ['MTL', makeMomentum(-3)],
      ]);
      // gap is 6 < 8
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).not.toContain('Hot vs Cold');
    });

    it('picks the largest momentum gap when multiple exist', () => {
      const games = [makeGame('TOR', 'MTL'), makeGame('BOS', 'NYR')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(5)],
        ['MTL', makeMomentum(-4)], // gap 9
        ['BOS', makeMomentum(8)],
        ['NYR', makeMomentum(-3)], // gap 11
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).toContain('BOS');
      expect(result).toContain('NYR');
    });

    it('shows + sign for positive scores and no double-sign for negative', () => {
      const games = [makeGame('TOR', 'MTL')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(9)],
        ['MTL', makeMomentum(-1)],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).toContain('+9');
      expect(result).toContain('-1');
      expect(result).not.toContain('+-');
    });
  });

  describe('default headline', () => {
    it('shows game count for 1 game', () => {
      const games = [makeGame('TOR', 'MTL')];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).toBe('1 Games on the Slate Tonight');
    });

    it('shows game count for 6 games', () => {
      const games = Array.from({ length: 6 }, (_, i) =>
        makeGame('TOR', `T${String(i).padStart(2, '0')}` as any)
      );
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      expect(result).toBe('6 Games on the Slate Tonight');
    });
  });

  describe('priority ordering', () => {
    it('rivalry beats division showdown', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'OTT'),
        makeGame('DET', 'BUF'),
      ];
      const standings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic' },
        { abbrev: 'MTL', division: 'Atlantic' },
        { abbrev: 'BOS', division: 'Atlantic' },
        { abbrev: 'OTT', division: 'Atlantic' },
        { abbrev: 'DET', division: 'Atlantic' },
        { abbrev: 'BUF', division: 'Atlantic' },
      ]);
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 2, 2)]]);
      const result = generateTonightHeadline(games, standings, h2h, new Map(), new Map());
      expect(result).toContain('Rivalry Night');
      expect(result).not.toContain('Division Showdown');
    });

    it('division showdown beats streak', () => {
      const games = [
        makeGame('TOR', 'MTL', 'W7'),
        makeGame('BOS', 'OTT'),
        makeGame('DET', 'BUF'),
      ];
      const standings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic' },
        { abbrev: 'MTL', division: 'Atlantic' },
        { abbrev: 'BOS', division: 'Atlantic' },
        { abbrev: 'OTT', division: 'Atlantic' },
        { abbrev: 'DET', division: 'Atlantic' },
        { abbrev: 'BUF', division: 'Atlantic' },
      ]);
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      expect(result).toContain('Division Showdown');
      expect(result).not.toContain('Streak Alert');
    });

    it('revenge beats streak', () => {
      const games = [makeGame('TOR', 'MTL', 'W7')];
      const h2h = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 3, 0)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      expect(result).toContain('Revenge Game');
      expect(result).not.toContain('Streak Alert');
    });

    it('streak beats fatigue factor', () => {
      const games = [
        makeGame('TOR', 'MTL', 'W6'),
        makeGame('BOS', 'NYR'),
      ];
      const restMap = new Map([
        ['TOR', 0],
        ['MTL', 0],
        ['BOS', 0],
        ['NYR', 0],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), new Map(), restMap);
      expect(result).toContain('Streak Alert');
      expect(result).not.toContain('Fatigue Factor');
    });

    it('fatigue factor beats momentum', () => {
      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'NYR'),
      ];
      const restMap = new Map([
        ['TOR', 0],
        ['MTL', 0],
        ['BOS', 0],
        ['NYR', 2],
      ]);
      const momentumMap = new Map([
        ['TOR', makeMomentum(10)],
        ['MTL', makeMomentum(-5)],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, restMap);
      expect(result).toContain('Fatigue Factor');
      expect(result).not.toContain('Hot vs Cold');
    });

    it('momentum beats default', () => {
      const games = [makeGame('TOR', 'MTL')];
      const momentumMap = new Map([
        ['TOR', makeMomentum(8)],
        ['MTL', makeMomentum(-2)],
      ]);
      const result = generateTonightHeadline(games, null, new Map(), momentumMap, new Map());
      expect(result).toContain('Hot vs Cold');
      expect(result).not.toContain('Slate Tonight');
    });
  });

  describe('character length constraint', () => {
    it('all headline types produce strings under 60 characters', () => {
      // Test each headline type
      const headlines: string[] = [];

      // Default
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL')], null, new Map(), new Map(), new Map()));

      // Rivalry
      const h2hRivalry = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 2, 2)]]);
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL')], null, h2hRivalry, new Map(), new Map()));

      // Division
      const divGames = [makeGame('TOR', 'MTL'), makeGame('BOS', 'OTT'), makeGame('DET', 'BUF')];
      const divStandings = makeStandings([
        { abbrev: 'TOR', division: 'Atlantic' }, { abbrev: 'MTL', division: 'Atlantic' },
        { abbrev: 'BOS', division: 'Atlantic' }, { abbrev: 'OTT', division: 'Atlantic' },
        { abbrev: 'DET', division: 'Atlantic' }, { abbrev: 'BUF', division: 'Atlantic' },
      ]);
      headlines.push(generateTonightHeadline(divGames, divStandings, new Map(), new Map(), new Map()));

      // Revenge
      const h2hRevenge = new Map([['TOR-MTL', makeH2H('TOR', 'MTL', 3, 0)]]);
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL')], null, h2hRevenge, new Map(), new Map()));

      // Streak
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL', 'W5')], null, new Map(), new Map(), new Map()));

      // Fatigue
      const restMap = new Map<string, number>([['TOR', 0], ['MTL', 0], ['BOS', 0]]);
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL'), makeGame('BOS', 'NYR')], null, new Map(), new Map(), restMap));

      // Momentum
      const momMap = new Map([['TOR', makeMomentum(9)], ['MTL', makeMomentum(-1)]]);
      headlines.push(generateTonightHeadline([makeGame('TOR', 'MTL')], null, new Map(), momMap, new Map()));

      headlines.forEach((headline) => {
        expect(headline.length).toBeLessThanOrEqual(60);
      });
    });
  });

  describe('edge cases with malformed data', () => {
    it('handles games with missing team abbrevs', () => {
      const games = [{ homeTeam: {}, awayTeam: {} }];
      const result = generateTonightHeadline(games, null, new Map(), new Map(), new Map());
      // Should fall through to default
      expect(result).toBe('1 Games on the Slate Tonight');
    });

    it('handles games with undefined teams', () => {
      const games = [{ homeTeam: undefined, awayTeam: undefined }];
      const result = generateTonightHeadline(games as any, null, new Map(), new Map(), new Map());
      expect(result).toBe('1 Games on the Slate Tonight');
    });

    it('handles standings with string teamAbbrev (non-nested)', () => {
      const games = [makeGame('TOR', 'MTL', 'W5')];
      const standings = {
        standings: [
          { teamAbbrev: 'TOR', divisionName: 'Atlantic', streakCode: 'W5' },
          { teamAbbrev: 'MTL', divisionName: 'Atlantic' },
        ],
      };
      const result = generateTonightHeadline(games, standings as any, new Map(), new Map(), new Map());
      expect(result).toContain('Streak Alert');
    });

    it('handles empty standings array', () => {
      const games = [makeGame('TOR', 'MTL')];
      const standings = { standings: [] };
      const result = generateTonightHeadline(games, standings, new Map(), new Map(), new Map());
      // Should fall to default since no division/streak data
      expect(result).toBe('1 Games on the Slate Tonight');
    });

    it('handles H2H map with no matching key format', () => {
      const games = [makeGame('TOR', 'MTL')];
      // Key format doesn't match "away-home"
      const h2h = new Map([['MTL-TOR', makeH2H('MTL', 'TOR', 2, 2)]]);
      const result = generateTonightHeadline(games, null, h2h, new Map(), new Map());
      // Key is TOR-MTL but we stored MTL-TOR, so no rivalry found
      expect(result).not.toContain('Rivalry Night');
    });
  });
});
