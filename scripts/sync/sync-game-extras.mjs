/**
 * Incremental sync for game extras: play-by-play, right-rail, boxscores.
 * Only processes games completed since last sync (not the full season).
 *
 * Usage:
 *   node scripts/sync/sync-game-extras.mjs          # Incremental (yesterday + today)
 *   node scripts/sync/sync-game-extras.mjs --full    # All completed games missing extras
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { formatDate, fetchWithRetry, sleep, parseSeasonArg } from './nhl-api.mjs';

const NHL_API = 'https://api-web.nhle.com/v1';
const isFullSync = process.argv.includes('--full');
const { season: parsedSeason } = parseSeasonArg();
const hasSeasonFlag = process.argv.includes('--season') || process.argv.find(a => a.startsWith('--season='));
const seasonFilter = hasSeasonFlag ? parsedSeason : null;

/**
 * Find completed games that don't yet have play-by-play, right-rail, or boxscore data.
 * In incremental mode, only look at yesterday + today games.
 * When --season is provided, filters to only that season's games.
 */
async function findNewCompletedGames() {
  if (isFullSync) {
    // Full mode: find ALL completed games missing play-by-play
    let query = supabase
      .from('games')
      .select('id')
      .in('game_state', ['FINAL', 'OFF'])
      .order('id');

    if (seasonFilter) {
      query = query.eq('season', seasonFilter);
    }

    const { data: allCompleted } = await query;

    const { data: existingPbp } = await supabase
      .from('game_play_by_play')
      .select('game_id');

    const existingIds = new Set((existingPbp || []).map(g => g.game_id));
    return (allCompleted || []).filter(g => !existingIds.has(g.id)).map(g => g.id);
  }

  // Incremental: only yesterday + today
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = [formatDate(yesterday), formatDate(today)];

  let query = supabase
    .from('games')
    .select('id')
    .in('game_state', ['FINAL', 'OFF'])
    .in('game_date', dates);

  if (seasonFilter) {
    query = query.eq('season', seasonFilter);
  }

  const { data: recentGames } = await query;

  return (recentGames || []).map(g => g.id);
}

/**
 * Sync play-by-play for new games.
 */
async function syncPlayByPlay(gameIds) {
  if (gameIds.length === 0) return 0;
  console.log(`  [pbp] Processing ${gameIds.length} games...`);

  let totalEvents = 0;
  for (const gameId of gameIds) {
    try {
      const data = await fetchWithRetry(`${NHL_API}/gamecenter/${gameId}/play-by-play`);
      const plays = data?.plays || [];
      if (plays.length === 0) continue;

      const rows = plays.map(play => {
        const details = play.details || {};
        let playerId = details.scoringPlayerId || details.shootingPlayerId
          || details.hittingPlayerId || details.winningPlayerId || details.playerId || null;

        let teamAbbrev = null;
        if (details.eventOwnerTeamId) {
          if (data.awayTeam?.id === details.eventOwnerTeamId) teamAbbrev = data.awayTeam.abbrev;
          else if (data.homeTeam?.id === details.eventOwnerTeamId) teamAbbrev = data.homeTeam.abbrev;
        }

        return {
          game_id: gameId,
          event_id: play.eventId,
          period: play.periodDescriptor?.number || null,
          period_type: play.periodDescriptor?.periodType || null,
          time_in_period: play.timeInPeriod || null,
          time_remaining: play.timeRemaining || null,
          situation_code: play.situationCode || null,
          event_type: play.typeDescKey || 'unknown',
          type_desc: play.typeDescKey || null,
          x_coord: details.xCoord ?? null,
          y_coord: details.yCoord ?? null,
          zone_code: details.zoneCode || null,
          player_id: playerId,
          player_name: null,
          team_abbrev: teamAbbrev,
          detail: Object.keys(details).length > 0 ? details : null,
        };
      });

      // Batch upsert
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('game_play_by_play')
          .upsert(batch, { onConflict: 'game_id,event_id' });
        if (error) console.warn(`    [pbp] game ${gameId} batch error: ${error.message}`);
      }
      totalEvents += rows.length;
    } catch (err) {
      // Non-fatal
    }
    await sleep(100);
  }

  console.log(`  [pbp] ${totalEvents} events synced`);
  return totalEvents;
}

/**
 * Sync right-rail (game details) for new games.
 */
async function syncRightRail(gameIds) {
  if (gameIds.length === 0) return 0;
  console.log(`  [right-rail] Processing ${gameIds.length} games...`);

  let synced = 0;
  for (const gameId of gameIds) {
    try {
      const data = await fetchWithRetry(`${NHL_API}/gamecenter/${gameId}/right-rail`);
      if (!data) continue;

      const row = {
        game_id: gameId,
        officials: data.gameInfo?.referees || null,
        coaches: data.gameInfo?.awayTeam?.headCoach || data.gameInfo?.homeTeam?.headCoach
          ? { away: data.gameInfo?.awayTeam?.headCoach || null, home: data.gameInfo?.homeTeam?.headCoach || null }
          : null,
        scratches: data.gameInfo?.awayTeam?.scratches || data.gameInfo?.homeTeam?.scratches
          ? { away: data.gameInfo?.awayTeam?.scratches || [], home: data.gameInfo?.homeTeam?.scratches || [] }
          : null,
        shots_by_period: data.shotsByPeriod || null,
        season_series: data.seasonSeries || null,
        team_game_stats: data.teamGameStats || null,
        game_reports: data.gameReports || null,
        fetched_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('game_details')
        .upsert([row], { onConflict: 'game_id' });
      if (error) console.warn(`    [right-rail] game ${gameId}: ${error.message}`);
      else synced++;
    } catch (err) {
      // Non-fatal
    }
    await sleep(100);
  }

  console.log(`  [right-rail] ${synced} game details synced`);
  return synced;
}

/**
 * Sync boxscore stats (per-game skater/goalie) for new games.
 */
async function syncBoxscores(gameIds) {
  if (gameIds.length === 0) return 0;
  console.log(`  [boxscore] Processing ${gameIds.length} games...`);

  let totalStats = 0;
  for (const gameId of gameIds) {
    try {
      const data = await fetchWithRetry(`${NHL_API}/gamecenter/${gameId}/boxscore`);
      if (!data?.playerByGameStats) continue;

      const skaterRows = [];
      const goalieRows = [];

      for (const side of ['awayTeam', 'homeTeam']) {
        const team = data[side];
        if (!team) continue;
        const teamAbbrev = team.abbrev;
        const stats = data.playerByGameStats?.[side] || {};

        // Forwards + defense = skaters
        for (const group of ['forwards', 'defense']) {
          for (const p of (stats[group] || [])) {
            skaterRows.push({
              game_id: gameId,
              player_id: p.playerId,
              team_abbrev: teamAbbrev,
              position: p.position || null,
              goals: p.goals ?? 0,
              assists: p.assists ?? 0,
              points: p.points ?? 0,
              plus_minus: p.plusMinus ?? 0,
              pim: p.pim ?? 0,
              hits: p.hits ?? 0,
              blocked_shots: p.blockedShots ?? 0,
              power_play_goals: p.powerPlayGoals ?? 0,
              shots_on_goal: p.sog ?? p.shots ?? 0,
              faceoff_win_pctg: p.faceoffWinningPctg ?? null,
              toi: p.toi ?? null,
              shifts: p.shifts ?? 0,
              giveaways: p.giveaways ?? 0,
              takeaways: p.takeaways ?? 0,
            });
          }
        }

        // Goalies
        for (const g of (stats.goalies || [])) {
          goalieRows.push({
            game_id: gameId,
            player_id: g.playerId,
            team_abbrev: teamAbbrev,
            decision: g.decision || null,
            starter: g.starter ?? false,
            goals_against: g.goalsAgainst ?? 0,
            shots_against: g.saveShotsAgainst ? parseInt(g.saveShotsAgainst.split('/')[1] || '0') : 0,
            saves: g.saveShotsAgainst ? parseInt(g.saveShotsAgainst.split('/')[0] || '0') : 0,
            save_pctg: g.savePctg ?? null,
            pim: g.pim ?? 0,
            toi: g.toi ?? null,
          });
        }
      }

      // Upsert skaters
      if (skaterRows.length > 0) {
        const { error } = await supabase
          .from('game_skater_stats')
          .upsert(skaterRows, { onConflict: 'game_id,player_id' });
        if (error) console.warn(`    [boxscore] skater error game ${gameId}: ${error.message}`);
      }

      // Upsert goalies
      if (goalieRows.length > 0) {
        const { error } = await supabase
          .from('game_goalie_stats')
          .upsert(goalieRows, { onConflict: 'game_id,player_id' });
        if (error) console.warn(`    [boxscore] goalie error game ${gameId}: ${error.message}`);
      }

      totalStats += skaterRows.length + goalieRows.length;
    } catch (err) {
      // Non-fatal
    }
    await sleep(100);
  }

  console.log(`  [boxscore] ${totalStats} player-game stats synced`);
  return totalStats;
}

// Main
logConnectionInfo();
if (seasonFilter) {
  console.log(`[sync-game-extras] Using season override: ${seasonFilter}`);
}
console.log(`[sync-game-extras] Mode: ${isFullSync ? 'FULL' : 'INCREMENTAL'}`);

try {
  const gameIds = await findNewCompletedGames();
  console.log(`[sync-game-extras] Found ${gameIds.length} games to process`);

  if (gameIds.length === 0) {
    console.log('[sync-game-extras] Nothing to sync');
    process.exit(0);
  }

  const pbpCount = await syncPlayByPlay(gameIds);
  const rrCount = await syncRightRail(gameIds);
  const bsCount = await syncBoxscores(gameIds);

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'game_extras',
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: pbpCount + rrCount + bsCount,
    });
  } catch { /* sync_log may not exist */ }

  console.log(`[sync-game-extras] Done: ${pbpCount} events, ${rrCount} details, ${bsCount} box stats`);
} catch (err) {
  console.error('[sync-game-extras] Fatal error:', err);
  process.exit(1);
}
