import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clubTeamsForSeason,
  normalizeClubStats,
  normalizeFullSeasonGames,
  normalizeGames,
  normalizePlayerBiography,
  normalizeTeamCategory,
  writeSyncLog,
  upsertBatches,
} from '../ingestion-contracts.mjs';

const season = 20252026;

test('club stats preserve NHL zero values and use the real skater and goalie field names', () => {
  const result = normalizeClubStats({
    season: '20252026',
    gameType: 2,
    skaters: [{
      playerId: 1,
      positionCode: 'C',
      gamesPlayed: 2,
      goals: 0,
      assists: 1,
      points: 1,
      plusMinus: -1,
      penaltyMinutes: 0,
      powerPlayGoals: 0,
      shorthandedGoals: 0,
      gameWinningGoals: 0,
      overtimeGoals: 0,
      shots: 4,
      shootingPctg: 0,
      avgTimeOnIcePerGame: 601.5,
      avgShiftsPerGame: 18.5,
      faceoffWinPctg: 0,
    }],
    goalies: [{
      playerId: 2,
      gamesPlayed: 1,
      gamesStarted: 1,
      wins: 0,
      losses: 0,
      overtimeLosses: 1,
      goalsAgainstAverage: 0,
      savePercentage: 0,
      shotsAgainst: 0,
      saves: 0,
      goalsAgainst: 0,
      shutouts: 0,
      goals: 0,
      assists: 0,
      penaltyMinutes: 0,
      timeOnIce: 3600,
    }],
  }, 'EDM', season);

  assert.deepEqual(result.skaters[0], {
    player_id: 1,
    season,
    team_abbrev: 'EDM',
    position: 'C',
    games_played: 2,
    goals: 0,
    assists: 1,
    points: 1,
    plus_minus: -1,
    pim: 0,
    power_play_goals: 0,
    shorthanded_goals: 0,
    game_winning_goals: 0,
    overtime_goals: 0,
    shots: 4,
    shooting_pctg: 0,
    avg_toi_per_game: 601.5,
    avg_shifts_per_game: 18.5,
    faceoff_win_pctg: 0,
  });
  assert.deepEqual(result.goalies[0], {
    player_id: 2,
    season,
    team_abbrev: 'EDM',
    games_played: 1,
    games_started: 1,
    wins: 0,
    losses: 0,
    ot_losses: 1,
    goals_against_avg: 0,
    save_pctg: 0,
    shots_against: 0,
    saves: 0,
    goals_against: 0,
    shutouts: 0,
    goals: 0,
    assists: 0,
    pim: 0,
    toi_seconds: 3600,
  });
});

test('club stats preserve absent nullable values as null', () => {
  const result = normalizeClubStats({
    season: season,
    gameType: 2,
    skaters: [{ playerId: 1 }],
    goalies: [{ playerId: 2 }],
  }, 'EDM', season);

  assert.equal(result.skaters[0].games_played, null);
  assert.equal(result.skaters[0].shooting_pctg, null);
  assert.equal(result.goalies[0].games_played, null);
  assert.equal(result.goalies[0].save_pctg, null);
});

test('club stats reject the wrong period, duplicate players, and invalid cumulative values', () => {
  const base = { season, gameType: 2, skaters: [], goalies: [] };
  assert.throws(() => normalizeClubStats(base, 'EDM', season), /no players/i);
  assert.throws(() => normalizeClubStats({ ...base, gameType: 3 }, 'EDM', season), /game type/i);
  assert.throws(() => normalizeClubStats({ ...base, season: 20242025 }, 'EDM', season), /season/i);
  assert.throws(() => normalizeClubStats({ ...base, skaters: [{ playerId: 1 }, { playerId: 1 }] }, 'EDM', season), /duplicate/i);
  assert.throws(() => normalizeClubStats({ ...base, goalies: [{ playerId: 0 }] }, 'EDM', season), /player/i);
  assert.throws(() => normalizeClubStats({ ...base, skaters: [{ playerId: 1, goals: 2, assists: 1, points: 2 }] }, 'EDM', season), /points/i);
  assert.throws(() => normalizeClubStats({ ...base, skaters: [{ playerId: 1, shots: -1 }] }, 'EDM', season), /shots/i);
  assert.throws(() => normalizeClubStats({ ...base, goalies: [{ playerId: 1, savePercentage: 1.1 }] }, 'EDM', season), /savePercentage/i);
});

test('team category rows require complete exact-period data for known unique teams', () => {
  const fetchedAt = '2026-09-10T12:00:00.000Z';
  const payload = {
    total: 2,
    data: [
      { teamId: 22, seasonId: season, gameTypeId: 2, gamesPlayed: 82 },
      { teamId: 10, seasonId: season, gamesPlayed: 82, customField: null },
    ],
  };
  const rows = normalizeTeamCategory(payload, 'summary', season, new Map([[22, 'EDM'], [10, 'TOR']]), fetchedAt);

  assert.deepEqual(rows, [
    { team_abbrev: 'EDM', season, stat_category: 'summary', data: payload.data[0], fetched_at: fetchedAt },
    { team_abbrev: 'TOR', season, stat_category: 'summary', data: payload.data[1], fetched_at: fetchedAt },
  ]);

  assert.throws(() => normalizeTeamCategory({ ...payload, total: 3 }, 'summary', season, new Map([[22, 'EDM'], [10, 'TOR']]), fetchedAt), /total/i);
  assert.throws(() => normalizeTeamCategory({ data: [{ teamId: 22, seasonId: 20242025 }] }, 'summary', season, new Map([[22, 'EDM']]), fetchedAt), /season/i);
  assert.throws(() => normalizeTeamCategory({ data: [{ teamId: 22, seasonId: season, gameTypeId: 3 }] }, 'summary', season, new Map([[22, 'EDM']]), fetchedAt), /game type/i);
  assert.throws(() => normalizeTeamCategory({ data: [{ teamId: 99, seasonId: season }] }, 'summary', season, new Map([[22, 'EDM']]), fetchedAt), /unknown team/i);
  assert.throws(() => normalizeTeamCategory({ data: [{ teamId: 22, seasonId: season }, { teamId: 22, seasonId: season }] }, 'summary', season, new Map([[22, 'EDM']]), fetchedAt), /duplicate/i);
});

const rawGame = {
  id: 2025020001,
  season,
  gameType: 2,
  gameDate: '2025-10-07',
  startTimeUTC: '2025-10-07T23:00:00Z',
  venue: { default: 'Arena' },
  gameState: 'FUT',
  gameScheduleState: 'OK',
  awayTeam: { abbrev: 'TOR', score: 0 },
  homeTeam: { abbrev: 'EDM', score: 0 },
};

test('games require matching source period and preserve equal duplicates', () => {
  const rows = normalizeGames([rawGame, structuredClone(rawGame)], season);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: 2025020001,
    season,
    game_type: 2,
    game_date: '2025-10-07',
    start_time_utc: '2025-10-07T23:00:00Z',
    venue: 'Arena',
    game_state: 'FUT',
    game_schedule_state: 'OK',
    away_team_abbrev: 'TOR',
    away_score: 0,
    away_sog: null,
    home_team_abbrev: 'EDM',
    home_score: 0,
    home_sog: null,
    period: null,
    period_type: null,
  });
});

test('games reject missing or inconsistent season/type/ID evidence and conflicting duplicates', () => {
  assert.throws(() => normalizeGames([{ ...rawGame, season: undefined }], season), /season/i);
  assert.throws(() => normalizeGames([{ ...rawGame, season: 20242025 }], season), /season/i);
  assert.throws(() => normalizeGames([{ ...rawGame, gameType: undefined }], season), /game type/i);
  assert.throws(() => normalizeGames([{ ...rawGame, gameType: 4 }], season), /game type/i);
  assert.throws(() => normalizeGames([{ ...rawGame, gameType: 3 }], season), /game id/i);
  assert.throws(() => normalizeGames([{ ...rawGame, id: 2024020001 }], season), /game id/i);
  assert.throws(() => normalizeGames([rawGame, { ...rawGame, gameState: 'FINAL' }], season), /conflicting duplicate/i);
});

test('games accept valid preseason and playoff IDs in the requested season', () => {
  const rows = normalizeGames([
    { ...rawGame, id: 2025010001, gameType: 1 },
    { ...rawGame, id: 2025030001, gameType: 3 },
  ], season);
  assert.deepEqual(rows.map(row => row.game_type), [1, 3]);
});

test('full-season game snapshots cannot complete with zero games', () => {
  assert.throws(() => normalizeFullSeasonGames([], season), /no games/i);
});

test('future games may have unknown scores but final games may not', () => {
  const [future] = normalizeGames([{
    ...rawGame,
    awayTeam: { abbrev: 'TOR' },
    homeTeam: { abbrev: 'EDM' },
  }], season);
  assert.equal(future.away_score, null);
  assert.equal(future.home_score, null);

  assert.throws(() => normalizeGames([{
    ...rawGame,
    gameState: 'FINAL',
    awayTeam: { abbrev: 'TOR' },
    homeTeam: { abbrev: 'EDM', score: 2 },
  }], season), /final.*score/i);
});

test('batch writes count only successful rows and reject returned database errors', async () => {
  const writes = [];
  const okClient = {
    from(table) {
      return {
        async upsert(rows, options) {
          writes.push({ table, rows, options });
          return { error: null };
        },
      };
    },
  };
  assert.equal(await upsertBatches(okClient, 'games', [{ id: 1 }, { id: 2 }, { id: 3 }], 'id', 2), 3);
  assert.equal(writes.length, 2);

  const failedClient = {
    from() {
      return { async upsert() { return { error: { message: 'relation "games" does not exist' } }; } };
    },
  };
  await assert.rejects(() => upsertBatches(failedClient, 'games', [{ id: 1 }], 'id'), /does not exist/i);
});

test('batch write failures expose only rows confirmed before the failed batch', async () => {
  let calls = 0;
  const client = {
    from() {
      return {
        async upsert() {
          calls += 1;
          return calls === 1 ? { error: null } : { error: { message: 'write failed' } };
        },
      };
    },
  };

  await assert.rejects(
    () => upsertBatches(client, 'games', [{ id: 1 }, { id: 2 }, { id: 3 }], 'id', 2),
    error => error.message.includes('write failed') && error.rowsUpserted === 2,
  );
});

test('club team coverage handles the Arizona to Utah transition and fails unsupported periods', () => {
  const currentTeams = ['EDM', 'UTA', 'TOR'];
  assert.deepEqual(clubTeamsForSeason(20232024, currentTeams), ['EDM', 'ARI', 'TOR']);
  assert.deepEqual(clubTeamsForSeason(20252026, currentTeams), currentTeams);
  assert.throws(() => clubTeamsForSeason(20222023, currentTeams), /unsupported/i);
  assert.throws(() => clubTeamsForSeason(20272028, currentTeams), /unsupported/i);
});

test('sync log writes reject returned database errors', async () => {
  const okClient = {
    from() { return { async insert() { return { error: null }; } }; },
  };
  await writeSyncLog(okClient, { sync_type: 'games', status: 'completed' });

  const failedClient = {
    from() { return { async insert() { return { error: { message: 'log unavailable' } }; } }; },
  };
  await assert.rejects(
    () => writeSyncLog(failedClient, { sync_type: 'games', status: 'failed' }),
    /log unavailable/i,
  );
});

test('player biographies use current landing-page membership independently of historical club stats', () => {
  const row = normalizePlayerBiography({
    playerId: 1,
    firstName: { default: 'Taylor' },
    lastName: { default: 'Example' },
    position: 'C',
    currentTeamId: 10,
    currentTeamAbbrev: 'TOR',
    sweaterNumber: 0,
    isActive: false,
    draftDetails: { year: 2020, round: 1, pickInRound: 0, overallPick: 0 },
  }, 1);

  assert.equal(row.current_team_abbrev, 'TOR');
  assert.equal(row.sweater_number, 0);
  assert.equal(row.is_active, false);
  assert.equal(row.draft_pick, 0);
  assert.throws(() => normalizePlayerBiography({ playerId: 2 }, 1), /player ID/i);
});
