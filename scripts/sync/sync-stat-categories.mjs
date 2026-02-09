/**
 * Sync team stat categories (powerplay, penaltykill, summary) from NHL Stats API.
 *
 * Lightweight daily sync — only 3 categories × 1 API call each.
 * The ML pipeline's jsonb_lookup features need powerplay and penaltykill data
 * in the team_stat_categories table to compute pp% and pk%.
 *
 * Usage:
 *   node scripts/sync/sync-stat-categories.mjs
 *   node scripts/sync/sync-stat-categories.mjs --season 20242025
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { fetchWithRetry, sleep, getCurrentSeason, parseSeasonArg } from './nhl-api.mjs';

const STATS_API = 'https://api.nhle.com/stats/rest/en';
const CATEGORIES = ['powerplay', 'penaltykill', 'summary'];
const DELAY_MS = 1500;

// Parse season from args or use current
const { season } = parseSeasonArg();

async function syncStatCategories() {
  console.log(`[sync-stat-categories] Syncing ${CATEGORIES.length} categories for season ${season}`);

  // Build team ID -> abbreviation mapping from Supabase
  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('id, abbrev');

  if (teamErr || !teams || teams.length === 0) {
    console.error('[sync-stat-categories] Failed to load team mapping:', teamErr?.message);
    return { upserted: 0, errors: 1 };
  }

  const idToAbbrev = new Map(teams.map(t => [t.id, t.abbrev]));
  console.log(`[sync-stat-categories] Loaded ${idToAbbrev.size} team abbreviations`);

  let totalUpserted = 0;
  let errors = 0;

  for (const category of CATEGORIES) {
    try {
      const url = `${STATS_API}/team/${category}?cayenneExp=seasonId=${season}`;
      const result = await fetchWithRetry(url);
      const apiData = result?.data || [];

      if (apiData.length === 0) {
        console.log(`  [${category}] No data returned`);
        continue;
      }

      // Map API rows to our table format
      const rows = [];
      for (const row of apiData) {
        const abbrev = idToAbbrev.get(row.teamId);
        if (!abbrev) continue;

        rows.push({
          team_abbrev: abbrev,
          season: season,
          stat_category: category,
          data: row,
          fetched_at: new Date().toISOString(),
        });
      }

      // Deduplicate by team_abbrev (keep last occurrence)
      const deduped = [...new Map(rows.map(r => [r.team_abbrev, r])).values()];

      // Upsert in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
        const batch = deduped.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('team_stat_categories')
          .upsert(batch, { onConflict: 'team_abbrev,season,stat_category' });

        if (error) {
          console.error(`  [${category}] upsert error: ${error.message}`);
          errors++;
        }
      }

      totalUpserted += deduped.length;
      console.log(`  [${category}] ${deduped.length} teams synced`);

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  [${category}] FAILED: ${err.message}`);
      errors++;
    }
  }

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'stat_categories',
      status: errors > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: totalUpserted,
      error_message: errors > 0 ? `${errors} errors` : null,
    });
  } catch { /* sync_log may not exist yet */ }

  console.log(`[sync-stat-categories] Done: ${totalUpserted} upserted, ${errors} errors`);
  return { upserted: totalUpserted, errors };
}

// Main
logConnectionInfo();

try {
  const result = await syncStatCategories();
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-stat-categories] Fatal error:', err);
  process.exit(1);
}
