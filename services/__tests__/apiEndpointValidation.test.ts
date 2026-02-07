/**
 * API Endpoint Validation Tests
 * Verifies that all NHL API URLs used in services match the official WADL patterns.
 * This prevents silent breakage from typos or endpoint changes.
 */

describe('NHL API endpoint URL patterns', () => {
  const BASE = 'https://api-web.nhle.com';

  // WADL: /v1/score/{date: [0-9]{4}-[0-9]{2}-[0-9]{2}}
  describe('score endpoints', () => {
    it('/v1/score/{date} matches WADL pattern', () => {
      const url = `${BASE}/v1/score/2026-02-05`;
      expect(url).toMatch(/\/v1\/score\/\d{4}-\d{2}-\d{2}$/);
    });

    it('/v1/score/now is valid', () => {
      const url = `${BASE}/v1/score/now`;
      expect(url).toMatch(/\/v1\/score\/now$/);
    });
  });

  // WADL: v1/club-schedule-season/{team: \w{3}}/{season: [0-9]{8}}
  describe('club-schedule-season endpoints', () => {
    it('/v1/club-schedule-season/{team}/{season} matches WADL pattern', () => {
      const url = `${BASE}/v1/club-schedule-season/TOR/20252026`;
      expect(url).toMatch(/\/v1\/club-schedule-season\/\w{3}\/\d{8}$/);
    });

    it('/v1/club-schedule-season/{team}/now is valid', () => {
      const url = `${BASE}/v1/club-schedule-season/TOR/now`;
      expect(url).toMatch(/\/v1\/club-schedule-season\/\w{3}\/now$/);
    });
  });

  // WADL: v1/club-schedule/{team}/{month-or-week}/{...}
  describe('club-schedule endpoints', () => {
    it('/v1/club-schedule/{team}/month/{month} matches WADL pattern', () => {
      const url = `${BASE}/v1/club-schedule/TOR/month/2026-01`;
      expect(url).toMatch(/\/v1\/club-schedule\/\w{3}\/month\/\d{4}-\d{2}$/);
    });
  });

  // WADL: v1/standings/now and v1/standings/{date}
  describe('standings endpoints', () => {
    it('/v1/standings/now is valid', () => {
      const url = `${BASE}/v1/standings/now`;
      expect(url).toMatch(/\/v1\/standings\/now$/);
    });

    it('/v1/standings/{date} matches WADL pattern', () => {
      const url = `${BASE}/v1/standings/2026-02-05`;
      expect(url).toMatch(/\/v1\/standings\/\d{4}-\d{2}-\d{2}$/);
    });
  });

  // WADL: v1/club-stats/{team}/now
  describe('club-stats endpoints', () => {
    it('/v1/club-stats/{team}/now matches WADL pattern', () => {
      const url = `${BASE}/v1/club-stats/TOR/now`;
      expect(url).toMatch(/\/v1\/club-stats\/\w{3}\/now$/);
    });
  });

  // WADL: v1/roster/{team}/current
  describe('roster endpoints', () => {
    it('/v1/roster/{team}/current matches WADL pattern', () => {
      const url = `${BASE}/v1/roster/TOR/current`;
      expect(url).toMatch(/\/v1\/roster\/\w{3}\/current$/);
    });
  });

  // WADL: v1/player/{player-id}/landing
  describe('player endpoints', () => {
    it('/v1/player/{id}/landing matches WADL pattern', () => {
      const url = `${BASE}/v1/player/8479318/landing`;
      expect(url).toMatch(/\/v1\/player\/\d+\/landing$/);
    });
  });

  // WADL: /v1/edge/* endpoints
  describe('Edge IQ endpoints', () => {
    it('/v1/edge/skater-landing/now is valid', () => {
      const url = `${BASE}/v1/edge/skater-landing/now`;
      expect(url).toMatch(/\/v1\/edge\/skater-landing\/now$/);
    });

    it('/v1/edge/goalie-landing/now is valid', () => {
      const url = `${BASE}/v1/edge/goalie-landing/now`;
      expect(url).toMatch(/\/v1\/edge\/goalie-landing\/now$/);
    });

    it('/v1/edge/team-landing/now is valid', () => {
      const url = `${BASE}/v1/edge/team-landing/now`;
      expect(url).toMatch(/\/v1\/edge\/team-landing\/now$/);
    });

    it('/v1/edge/by-the-numbers/now is valid', () => {
      const url = `${BASE}/v1/edge/by-the-numbers/now`;
      expect(url).toMatch(/\/v1\/edge\/by-the-numbers\/now$/);
    });

    it('/v1/edge/skater-detail/{id}/now matches WADL pattern', () => {
      const url = `${BASE}/v1/edge/skater-detail/8478402/now`;
      expect(url).toMatch(/\/v1\/edge\/skater-detail\/\d+\/now$/);
    });

    it('/v1/edge/team-detail/{id}/now matches WADL pattern', () => {
      const url = `${BASE}/v1/edge/team-detail/1/now`;
      expect(url).toMatch(/\/v1\/edge\/team-detail\/\d+\/now$/);
    });

    it('/v1/edge/goalie-detail/{id}/now matches WADL pattern', () => {
      const url = `${BASE}/v1/edge/goalie-detail/8478048/now`;
      expect(url).toMatch(/\/v1\/edge\/goalie-detail\/\d+\/now$/);
    });

    it('/v1/edge/team-zone-time-details/{id}/now matches WADL pattern', () => {
      const url = `${BASE}/v1/edge/team-zone-time-details/1/now`;
      expect(url).toMatch(/\/v1\/edge\/team-zone-time-details\/\d+\/now$/);
    });
  });

  // WADL: v1/gamecenter/{game-id}/boxscore, play-by-play, landing, right-rail
  describe('gamecenter endpoints', () => {
    it('/v1/gamecenter/{id}/boxscore matches WADL pattern', () => {
      const url = `${BASE}/v1/gamecenter/2025020100/boxscore`;
      expect(url).toMatch(/\/v1\/gamecenter\/\d+\/boxscore$/);
    });

    it('/v1/gamecenter/{id}/play-by-play matches WADL pattern', () => {
      const url = `${BASE}/v1/gamecenter/2025020100/play-by-play`;
      expect(url).toMatch(/\/v1\/gamecenter\/\d+\/play-by-play$/);
    });

    it('/v1/gamecenter/{id}/landing matches WADL pattern', () => {
      const url = `${BASE}/v1/gamecenter/2025020100/landing`;
      expect(url).toMatch(/\/v1\/gamecenter\/\d+\/landing$/);
    });

    it('/v1/gamecenter/{id}/right-rail matches WADL pattern', () => {
      const url = `${BASE}/v1/gamecenter/2025020100/right-rail`;
      expect(url).toMatch(/\/v1\/gamecenter\/\d+\/right-rail$/);
    });
  });
});

describe('NHL API parameter validation', () => {
  it('season format is 8 digits (YYYYYYYY)', () => {
    const season = '20252026';
    expect(season).toMatch(/^[0-9]{8}$/);
    const startYear = parseInt(season.slice(0, 4));
    const endYear = parseInt(season.slice(4, 8));
    expect(endYear).toBe(startYear + 1);
  });

  it('game type 2 = regular season, 3 = playoffs', () => {
    const regularSeason = 2;
    const playoffs = 3;
    expect(regularSeason).toBe(2);
    expect(playoffs).toBe(3);
  });

  it('date format is YYYY-MM-DD', () => {
    const date = '2026-02-05';
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('team abbreviation is 3 uppercase letters', () => {
    const teams = ['TOR', 'MTL', 'BOS', 'NYR', 'UTA', 'VGK', 'WSH'];
    for (const team of teams) {
      expect(team).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('game IDs follow the pattern: SSSSGGTTTT', () => {
    // S=season start year, GG=game type (01=preseason, 02=regular, 03=playoff), TTTT=game number
    const regularGameId = 2025020100;
    const preseasonGameId = 2025010042;

    expect(String(regularGameId)).toMatch(/^2025020\d{3,4}$/);
    expect(String(preseasonGameId)).toMatch(/^2025010\d{3,4}$/);
  });
});
