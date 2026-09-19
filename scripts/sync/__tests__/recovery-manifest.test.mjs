import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECOVERY_TABLES,
  buildManifest,
  compareManifests,
  fetchAllPages,
  validateTarget,
} from '../../diagnostics/recovery-manifest.mjs';
import { exportRows, readOnlyConfig } from '../../diagnostics/recovery-export.mjs';

const season = 20252026;

function game(id, overrides = {}) {
  return {
    id,
    season,
    game_type: 2,
    game_date: '2025-10-07',
    start_time_utc: null,
    venue: null,
    venue_timezone: null,
    game_state: 'FINAL',
    game_schedule_state: 'OK',
    away_team_id: null,
    away_team_abbrev: 'TOR',
    away_sog: null,
    home_team_id: null,
    home_team_abbrev: 'EDM',
    away_score: 1,
    home_score: 2,
    home_sog: null,
    period: null,
    period_type: null,
    winning_goalie_id: null,
    losing_goalie_id: null,
    game_center_link: null,
    three_min_recap: null,
    neutral_site: null,
    ...overrides,
  };
}

test('recovery table contracts expose only schema-backed unique keys', () => {
  assert.deepEqual(RECOVERY_TABLES.games.keyColumns, ['id']);
  assert.deepEqual(RECOVERY_TABLES.standings.keyColumns, ['team_abbrev', 'season', 'snapshot_date']);
  assert.deepEqual(RECOVERY_TABLES.skater_season_stats.keyColumns, ['player_id', 'season', 'team_abbrev']);
  assert.deepEqual(RECOVERY_TABLES.goalie_season_stats.keyColumns, ['player_id', 'season', 'team_abbrev']);
  assert.deepEqual(RECOVERY_TABLES.team_stat_categories.keyColumns, ['team_abbrev', 'season', 'stat_category']);
  assert.equal(RECOVERY_TABLES.team_game_stats, undefined);
});

test('targets require an exact season and table-specific source period', () => {
  assert.deepEqual(validateTarget('games', { season, game_type: 2 }), {
    table: 'games',
    filters: { season, game_type: 2 },
  });
  assert.throws(() => validateTarget('games', { season }), /game_type/i);
  assert.throws(() => validateTarget('standings', { season }), /snapshot_date/i);
  assert.throws(() => validateTarget('games', { season, game_type: 3 }), /game_type/i);
  assert.throws(() => validateTarget('games', { season: 20242024, game_type: 2 }), /season/i);
});

test('read-only config rejects mismatched project URLs without exposing credentials', () => {
  assert.throws(() => readOnlyConfig({
    SUPABASE_URL: 'https://one.supabase.co',
    EXPO_PUBLIC_SUPABASE_URL: 'https://two.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  }), /URLs must match/i);
  assert.deepEqual(readOnlyConfig({
    SUPABASE_URL: 'https://one.supabase.co/',
    EXPO_PUBLIC_SUPABASE_URL: 'https://one.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  }), { url: 'https://one.supabase.co', key: 'test-key' });
});

test('exporter happy path records verified pagination and nonsecret provenance', async () => {
  const pages = [
    [game(1)],
    [game(2)],
  ];
  const client = {
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        range(from) { return Promise.resolve({ data: pages[from], error: null, count: 2 }); },
      };
      return query;
    },
  };
  const manifest = await exportRows({
    table: 'games',
    filters: { season, game_type: 2 },
    pageSize: 1,
    client,
    sourceUrl: 'https://example.supabase.co',
    exportedAt: '2026-09-12T12:00:00.000Z',
  });
  assert.deepEqual(manifest.fetch, { declared_count: 2, fetched_count: 2, page_count: 2, verified: true });
  assert.deepEqual(manifest.provenance, {
    atomic_snapshot: false,
    export_type: 'paginated_read',
    exported_at: '2026-09-12T12:00:00.000Z',
    source_url: 'https://example.supabase.co',
  });
});

test('paginated fetches fail when the exact server count is not reached', async () => {
  const calls = [];
  await assert.rejects(() => fetchAllPages(async (from, to) => {
    calls.push([from, to]);
    return { data: from === 0 ? [game(1)] : [], error: null, count: 2 };
  }, { pageSize: 1 }), /incomplete/i);
  assert.deepEqual(calls, [[0, 0], [1, 1]]);
});

test('paginated fetches return all rows only after count and page boundaries agree', async () => {
  const rows = await fetchAllPages(async (from, to) => ({
    data: [game(from + 1)],
    error: null,
    count: 2,
    from,
    to,
  }), { pageSize: 1 });
  assert.deepEqual(rows, [game(1), game(2)]);
});

test('manifest rejects rows outside the requested season or source period', () => {
  const target = { season, game_type: 2 };
  assert.throws(() => buildManifest('games', target, [game(1, { season: 20242025 })]), /outside requested/i);
  assert.throws(() => buildManifest('games', target, [game(1, { game_type: 3, id: 2025030001 })]), /outside requested/i);
  assert.throws(() => buildManifest('games', target, [game(1, { game_date: undefined })]), /missing.*compare|column/i);
  assert.throws(() => buildManifest('games', target, [game(1, { unknown_column: 1 })]), /unknown.*column/i);
});

test('date validation rejects calendar overflow instead of normalized dates', () => {
  assert.throws(() => validateTarget('standings', { season, snapshot_date: '2026-02-31' }), /valid.*date/i);
});

test('manifest reports duplicate keys and keeps stable sorted rows', () => {
  const manifest = buildManifest('games', { season, game_type: 2 }, [game(2), game(1), game(1)]);
  assert.equal(manifest.row_count, 3);
  assert.deepEqual(manifest.duplicate_keys, ['[1]']);
  assert.equal(manifest.complete, false);
  assert.deepEqual(manifest.rows.map(row => row.id), [1, 1, 2]);
  assert.equal(JSON.stringify(manifest), JSON.stringify(buildManifest('games', { game_type: 2, season }, [game(1), game(2), game(1)])));
});

test('comparison classifies changed, missing, and stale rows without proposing actions', () => {
  const reference = buildManifest('games', { season, game_type: 2 }, [game(1), game(2)]);
  const actual = buildManifest('games', { season, game_type: 2 }, [
    game(1, { home_score: 3 }),
    game(3),
  ]);
  const comparison = compareManifests(reference, actual);
  assert.deepEqual(comparison.changed_keys, ['[1]']);
  assert.deepEqual(comparison.missing_keys, ['[2]']);
  assert.deepEqual(comparison.stale_keys, ['[3]']);
  assert.equal(comparison.changed_rows[0].key, '[1]');
  assert.equal(comparison.changed_rows[0].actual.home_score, 3);
  assert.equal(comparison.missing_rows[0].row.id, 2);
  assert.equal(comparison.stale_rows[0].row.id, 3);
  assert.equal(comparison.equal, false);
  assert.equal(comparison.deletes_applied, false);
  assert.equal(comparison.applies_performed, false);
});

test('comparison rejects different targets and incomplete manifests', () => {
  const manifest = buildManifest('games', { season, game_type: 2 }, [game(1)]);
  const otherSeason = buildManifest('games', { season: 20242025, game_type: 2 }, [game(1, { season: 20242025 })]);
  assert.throws(() => compareManifests(manifest, otherSeason), /target/i);
  const duplicate = buildManifest('games', { season, game_type: 2 }, [game(1), game(1)]);
  assert.throws(() => compareManifests(manifest, duplicate), /incomplete|duplicate/i);
});

test('comparison recomputes unique-key coverage instead of trusting manifest metadata', () => {
  const manifest = buildManifest('games', { season, game_type: 2 }, [game(1)]);
  const tampered = structuredClone(manifest);
  tampered.rows = [game(1), game(1)];
  tampered.row_count = 2;
  tampered.unique_row_count = 2;
  tampered.duplicate_keys = [];
  tampered.duplicate_key_count = 0;
  tampered.complete = true;
  assert.throws(() => compareManifests(manifest, tampered), /duplicate|inconsistent/i);
});

test('comparison rejects manifests with incomplete or unknown row columns', () => {
  const complete = buildManifest('games', { season, game_type: 2 }, [game(1)]);
  const missing = structuredClone(complete);
  delete missing.rows[0].home_score;
  assert.throws(() => compareManifests(complete, missing), /missing.*column|row columns/i);
  const unknown = structuredClone(complete);
  unknown.row_columns = [...unknown.row_columns, 'unknown_column'];
  assert.throws(() => compareManifests(complete, unknown), /row columns|unknown/i);
});
