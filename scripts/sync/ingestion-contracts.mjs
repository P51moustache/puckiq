import { isDeepStrictEqual } from 'node:util';

const hasValue = value => value !== null && value !== undefined;

export function clubTeamsForSeason(season, currentTeams) {
  if (!Array.isArray(currentTeams) || currentTeams.length === 0) throw new Error('Current club team coverage is empty');
  if (season === 20232024) {
    if (!currentTeams.includes('UTA')) throw new Error('Current club team coverage cannot map Utah back to Arizona');
    return currentTeams.map(team => team === 'UTA' ? 'ARI' : team);
  }
  if (season >= 20242025 && season <= 20262027) return [...currentTeams];
  throw new Error(`Unsupported club team coverage for season ${season}`);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireSeason(value, season, label) {
  if (!hasValue(value) || !/^\d{8}$/.test(String(value)) || Number(value) !== season) {
    throw new Error(`${label} season does not match requested season ${season}`);
  }
}

function nullableNumber(value, label, { integer = false, nonnegative = false, probability = false } = {}) {
  if (!hasValue(value)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number when present`);
  }
  if (integer && !Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  if (nonnegative && value < 0) throw new Error(`${label} cannot be negative`);
  if (probability && (value < 0 || value > 1)) throw new Error(`${label} must be between 0 and 1`);
  return value;
}

function positiveId(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function normalizeSkater(player, team, season) {
  requireObject(player, `Skater for ${team}`);
  const row = {
    player_id: positiveId(player.playerId, `Skater player ID for ${team}`),
    season,
    team_abbrev: team,
    position: player.positionCode ?? null,
    games_played: nullableNumber(player.gamesPlayed, 'gamesPlayed', { integer: true, nonnegative: true }),
    goals: nullableNumber(player.goals, 'goals', { integer: true, nonnegative: true }),
    assists: nullableNumber(player.assists, 'assists', { integer: true, nonnegative: true }),
    points: nullableNumber(player.points, 'points', { integer: true, nonnegative: true }),
    plus_minus: nullableNumber(player.plusMinus, 'plusMinus', { integer: true }),
    pim: nullableNumber(player.penaltyMinutes, 'penaltyMinutes', { nonnegative: true }),
    power_play_goals: nullableNumber(player.powerPlayGoals, 'powerPlayGoals', { integer: true, nonnegative: true }),
    shorthanded_goals: nullableNumber(player.shorthandedGoals, 'shorthandedGoals', { integer: true, nonnegative: true }),
    game_winning_goals: nullableNumber(player.gameWinningGoals, 'gameWinningGoals', { integer: true, nonnegative: true }),
    overtime_goals: nullableNumber(player.overtimeGoals, 'overtimeGoals', { integer: true, nonnegative: true }),
    shots: nullableNumber(player.shots, 'shots', { integer: true, nonnegative: true }),
    shooting_pctg: nullableNumber(player.shootingPctg, 'shootingPctg', { probability: true }),
    avg_toi_per_game: nullableNumber(player.avgTimeOnIcePerGame, 'avgTimeOnIcePerGame', { nonnegative: true }),
    avg_shifts_per_game: nullableNumber(player.avgShiftsPerGame, 'avgShiftsPerGame', { nonnegative: true }),
    faceoff_win_pctg: nullableNumber(player.faceoffWinPctg, 'faceoffWinPctg', { probability: true }),
  };

  if (row.goals !== null && row.assists !== null && row.points !== null && row.points !== row.goals + row.assists) {
    throw new Error(`Skater ${row.player_id} points do not equal goals plus assists`);
  }
  return row;
}

function normalizeGoalie(player, team, season) {
  requireObject(player, `Goalie for ${team}`);
  const row = {
    player_id: positiveId(player.playerId, `Goalie player ID for ${team}`),
    season,
    team_abbrev: team,
    games_played: nullableNumber(player.gamesPlayed, 'gamesPlayed', { integer: true, nonnegative: true }),
    games_started: nullableNumber(player.gamesStarted, 'gamesStarted', { integer: true, nonnegative: true }),
    wins: nullableNumber(player.wins, 'wins', { integer: true, nonnegative: true }),
    losses: nullableNumber(player.losses, 'losses', { integer: true, nonnegative: true }),
    ot_losses: nullableNumber(player.overtimeLosses, 'overtimeLosses', { integer: true, nonnegative: true }),
    goals_against_avg: nullableNumber(player.goalsAgainstAverage, 'goalsAgainstAverage', { nonnegative: true }),
    save_pctg: nullableNumber(player.savePercentage, 'savePercentage', { probability: true }),
    shots_against: nullableNumber(player.shotsAgainst, 'shotsAgainst', { integer: true, nonnegative: true }),
    saves: nullableNumber(player.saves, 'saves', { integer: true, nonnegative: true }),
    goals_against: nullableNumber(player.goalsAgainst, 'goalsAgainst', { integer: true, nonnegative: true }),
    shutouts: nullableNumber(player.shutouts, 'shutouts', { integer: true, nonnegative: true }),
    goals: nullableNumber(player.goals, 'goals', { integer: true, nonnegative: true }),
    assists: nullableNumber(player.assists, 'assists', { integer: true, nonnegative: true }),
    pim: nullableNumber(player.penaltyMinutes, 'penaltyMinutes', { nonnegative: true }),
    toi_seconds: nullableNumber(player.timeOnIce, 'timeOnIce', { nonnegative: true }),
  };
  return row;
}

function normalizeUniquePlayers(players, type, team, season, normalizer) {
  if (!Array.isArray(players)) throw new Error(`${team} ${type} must be an array`);
  const ids = new Set();
  return players.map(player => {
    const row = normalizer(player, team, season);
    if (ids.has(row.player_id)) throw new Error(`Duplicate ${type} player ${row.player_id} for ${team}`);
    ids.add(row.player_id);
    return row;
  });
}

export function normalizeClubStats(payload, team, season) {
  requireObject(payload, `Club stats for ${team}`);
  requireSeason(payload.season, season, `Club stats for ${team}`);
  if (payload.gameType !== 2) throw new Error(`Club stats for ${team} have unexpected game type`);
  if (typeof team !== 'string' || !/^[A-Z]{3}$/.test(team)) throw new Error('Team abbreviation must contain three uppercase letters');

  const normalized = {
    skaters: normalizeUniquePlayers(payload.skaters, 'skater', team, season, normalizeSkater),
    goalies: normalizeUniquePlayers(payload.goalies, 'goalie', team, season, normalizeGoalie),
  };
  if (normalized.skaters.length + normalized.goalies.length === 0) {
    throw new Error(`Club stats for ${team} contain no players`);
  }
  return normalized;
}

function localizedText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.default === 'string') return value.default;
  return '';
}

export function normalizePlayerBiography(payload, expectedPlayerId) {
  requireObject(payload, `Player ${expectedPlayerId} biography`);
  const playerId = positiveId(payload.playerId, 'Biography player ID');
  if (playerId !== expectedPlayerId) throw new Error(`Biography player ID ${playerId} does not match requested player ID ${expectedPlayerId}`);
  const row = {
    id: playerId,
    first_name: localizedText(payload.firstName),
    last_name: localizedText(payload.lastName),
    position: payload.position ?? null,
    shoots_catches: payload.shootsCatches ?? null,
    height_inches: payload.heightInInches ?? null,
    weight_pounds: payload.weightInPounds ?? null,
    birth_date: payload.birthDate ?? null,
    birth_city: localizedText(payload.birthCity) || null,
    birth_country: payload.birthCountry ?? null,
    current_team_id: payload.currentTeamId ?? null,
    current_team_abbrev: payload.currentTeamAbbrev ?? null,
    sweater_number: payload.sweaterNumber ?? null,
    is_active: payload.isActive !== false,
    headshot_url: payload.headshot ?? null,
    draft_year: payload.draftDetails?.year ?? null,
    draft_round: payload.draftDetails?.round ?? null,
    draft_pick: payload.draftDetails?.pickInRound ?? null,
    draft_overall: payload.draftDetails?.overallPick ?? null,
  };
  return row;
}

export function normalizeTeamCategory(payload, category, season, teamMap, fetchedAt) {
  requireObject(payload, `Team ${category} response`);
  if (!Array.isArray(payload.data)) throw new Error(`Team ${category} data must be an array`);
  if (hasValue(payload.total)) {
    const total = nullableNumber(payload.total, 'total', { integer: true, nonnegative: true });
    if (total !== payload.data.length) throw new Error(`Team ${category} total does not match returned data length`);
  }
  if (!(teamMap instanceof Map) || teamMap.size === 0) throw new Error('Team map must be a nonempty Map');
  if (typeof category !== 'string' || category.length === 0) throw new Error('Category is required');
  if (typeof fetchedAt !== 'string' || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('fetchedAt must be an ISO date');

  const seenTeams = new Set();
  return payload.data.map(row => {
    requireObject(row, `Team ${category} row`);
    requireSeason(row.seasonId, season, `Team ${category} row`);
    if (hasValue(row.gameTypeId) && row.gameTypeId !== 2) throw new Error(`Team ${category} row has unexpected game type`);
    const teamId = positiveId(row.teamId, `Team ${category} team ID`);
    const abbrev = teamMap.get(teamId);
    if (!abbrev) throw new Error(`Team ${category} row has unknown team ID ${teamId}`);
    if (seenTeams.has(teamId)) throw new Error(`Duplicate team ${teamId} in ${category} response`);
    seenTeams.add(teamId);
    return { team_abbrev: abbrev, season, stat_category: category, data: row, fetched_at: fetchedAt };
  });
}

function nullableText(value, label, { required = false } = {}) {
  if (!hasValue(value)) {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  if (typeof value !== 'string' || (required && value.length === 0)) throw new Error(`${label} must be a string`);
  return value;
}

function normalizeGame(game, season) {
  requireObject(game, 'Game');
  requireSeason(game.season, season, `Game ${game.id ?? 'unknown'}`);
  if (![1, 2, 3].includes(game.gameType)) throw new Error(`Game ${game.id ?? 'unknown'} has invalid or missing game type`);
  const id = positiveId(game.id, 'Game ID');
  const idText = String(id);
  const seasonStart = String(season).slice(0, 4);
  const encodedType = Number(idText.slice(4, 6));
  if (!/^\d{10}$/.test(idText) || !idText.startsWith(seasonStart) || encodedType !== game.gameType) {
    throw new Error(`Game ID ${id} does not match season ${season} and game type ${game.gameType}`);
  }
  requireObject(game.awayTeam, `Game ${id} away team`);
  requireObject(game.homeTeam, `Game ${id} home team`);

  const row = {
    id,
    season,
    game_type: game.gameType,
    game_date: nullableText(game.gameDate, `Game ${id} date`, { required: true }),
    start_time_utc: nullableText(game.startTimeUTC, `Game ${id} start time`),
    venue: game.venue?.default ?? null,
    game_state: nullableText(game.gameState, `Game ${id} state`, { required: true }),
    game_schedule_state: game.gameScheduleState ?? 'OK',
    away_team_abbrev: nullableText(game.awayTeam.abbrev, `Game ${id} away abbreviation`, { required: true }),
    away_score: nullableNumber(game.awayTeam.score, `Game ${id} away score`, { integer: true, nonnegative: true }),
    away_sog: nullableNumber(game.awayTeam.sog, `Game ${id} away shots`, { integer: true, nonnegative: true }),
    home_team_abbrev: nullableText(game.homeTeam.abbrev, `Game ${id} home abbreviation`, { required: true }),
    home_score: nullableNumber(game.homeTeam.score, `Game ${id} home score`, { integer: true, nonnegative: true }),
    home_sog: nullableNumber(game.homeTeam.sog, `Game ${id} home shots`, { integer: true, nonnegative: true }),
    period: nullableNumber(game.periodDescriptor?.number, `Game ${id} period`, { integer: true, nonnegative: true }),
    period_type: game.periodDescriptor?.periodType ?? null,
  };
  if (['FINAL', 'OFF'].includes(row.game_state) && (row.away_score === null || row.home_score === null)) {
    throw new Error(`Final game ${id} must include both scores`);
  }
  return row;
}

export function normalizeGames(rawGames, season) {
  if (!Array.isArray(rawGames)) throw new Error('Games response must be an array');
  const rows = new Map();
  for (const game of rawGames) {
    const row = normalizeGame(game, season);
    const existing = rows.get(row.id);
    if (existing && !isDeepStrictEqual(existing, row)) throw new Error(`Conflicting duplicate game ID ${row.id}`);
    if (!existing) rows.set(row.id, row);
  }
  return [...rows.values()];
}

export function normalizeFullSeasonGames(rawGames, season) {
  if (!Array.isArray(rawGames) || rawGames.length === 0) {
    throw new Error(`Full-season game snapshot for ${season} contains no games`);
  }
  return normalizeGames(rawGames, season);
}

export async function upsertBatches(client, table, rows, conflictColumns, batchSize = 200) {
  if (!Array.isArray(rows)) throw new Error(`${table} rows must be an array`);
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('Batch size must be a positive integer');
  let upserted = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await client.from(table).upsert(batch, { onConflict: conflictColumns });
    if (error) {
      const failure = new Error(`${table} batch at ${index} failed: ${error.message}`);
      failure.rowsUpserted = upserted;
      throw failure;
    }
    upserted += batch.length;
  }
  return upserted;
}

export async function writeSyncLog(client, entry) {
  const { error } = await client.from('sync_log').insert(entry);
  if (error) throw new Error(`sync_log write failed: ${error.message}`);
}
