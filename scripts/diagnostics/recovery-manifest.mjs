const SEASON_PATTERN = /^\d{8}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const commonGameColumns = [
  'id', 'season', 'game_type', 'game_date', 'start_time_utc', 'venue', 'venue_timezone',
  'game_state', 'game_schedule_state', 'away_team_id', 'away_team_abbrev', 'away_score',
  'away_sog', 'home_team_id', 'home_team_abbrev', 'home_score', 'home_sog', 'period',
  'period_type', 'winning_goalie_id', 'losing_goalie_id', 'game_center_link',
  'three_min_recap', 'neutral_site',
];

const standingsColumns = [
  'team_id', 'team_abbrev', 'season', 'snapshot_date', 'games_played', 'wins', 'losses',
  'ot_losses', 'points', 'point_pctg', 'regulation_wins', 'regulation_plus_ot_wins',
  'goals_for', 'goals_against', 'goal_differential', 'goals_for_pctg', 'streak_code',
  'streak_count', 'home_wins', 'home_losses', 'home_ot_losses', 'home_goals_for',
  'home_goals_against', 'road_wins', 'road_losses', 'road_ot_losses', 'road_goals_for',
  'road_goals_against', 'l10_wins', 'l10_losses', 'l10_ot_losses', 'l10_points',
  'l10_goal_differential', 'shootout_wins', 'shootout_losses', 'conference',
  'conference_sequence', 'division', 'division_sequence', 'league_sequence',
  'wildcard_sequence',
];

const skaterColumns = [
  'player_id', 'season', 'team_abbrev', 'position', 'games_played', 'goals', 'assists',
  'points', 'plus_minus', 'pim', 'power_play_goals', 'shorthanded_goals',
  'game_winning_goals', 'overtime_goals', 'shots', 'shooting_pctg', 'avg_toi_per_game',
  'avg_shifts_per_game', 'faceoff_win_pctg',
];

const goalieColumns = [
  'player_id', 'season', 'team_abbrev', 'games_played', 'games_started', 'wins', 'losses',
  'ot_losses', 'goals_against_avg', 'save_pctg', 'shots_against', 'saves', 'goals_against',
  'shutouts', 'goals', 'assists', 'pim', 'toi_seconds',
];

const categoryColumns = ['team_abbrev', 'season', 'stat_category', 'data'];

const withoutVolatileColumns = columns => columns.filter(column => !['id'].includes(column));

export const RECOVERY_TABLES = Object.freeze({
  games: Object.freeze({
    keyColumns: Object.freeze(['id']),
    filterColumns: Object.freeze(['season', 'game_type']),
    requiredFilters: Object.freeze(['season', 'game_type']),
    selectColumns: Object.freeze(commonGameColumns),
    compareColumns: Object.freeze(withoutVolatileColumns(commonGameColumns)),
  }),
  standings: Object.freeze({
    keyColumns: Object.freeze(['team_abbrev', 'season', 'snapshot_date']),
    filterColumns: Object.freeze(['season', 'snapshot_date']),
    requiredFilters: Object.freeze(['season', 'snapshot_date']),
    selectColumns: Object.freeze(standingsColumns),
    compareColumns: Object.freeze(standingsColumns),
  }),
  skater_season_stats: Object.freeze({
    keyColumns: Object.freeze(['player_id', 'season', 'team_abbrev']),
    filterColumns: Object.freeze(['season']),
    requiredFilters: Object.freeze(['season']),
    selectColumns: Object.freeze(skaterColumns),
    compareColumns: Object.freeze(skaterColumns),
  }),
  goalie_season_stats: Object.freeze({
    keyColumns: Object.freeze(['player_id', 'season', 'team_abbrev']),
    filterColumns: Object.freeze(['season']),
    requiredFilters: Object.freeze(['season']),
    selectColumns: Object.freeze(goalieColumns),
    compareColumns: Object.freeze(goalieColumns),
  }),
  team_stat_categories: Object.freeze({
    keyColumns: Object.freeze(['team_abbrev', 'season', 'stat_category']),
    filterColumns: Object.freeze(['season', 'stat_category']),
    requiredFilters: Object.freeze(['season']),
    selectColumns: Object.freeze(categoryColumns),
    compareColumns: Object.freeze(categoryColumns),
  }),
});

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function validateSeason(season) {
  if (!Number.isInteger(season) || !SEASON_PATTERN.test(String(season)) || Number(season % 10000) !== Number(Math.floor(season / 10000) + 1)) {
    throw new Error('Recovery target season must contain consecutive years, e.g. 20252026');
  }
}

function validateDate(date, label) {
  const parsed = typeof date === 'string' && DATE_PATTERN.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date`);
  }
}

export function validateTarget(table, filters) {
  const spec = RECOVERY_TABLES[table];
  if (!spec) throw new Error(`Unsupported recovery table: ${table}`);
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new Error('Recovery target filters are required');
  for (const filter of Object.keys(filters)) {
    if (!spec.filterColumns.includes(filter)) throw new Error(`Unsupported ${table} target filter: ${filter}`);
  }
  for (const filter of spec.requiredFilters) {
    if (!(filter in filters)) throw new Error(`Recovery target requires ${filter}`);
  }
  validateSeason(filters.season);
  if ('game_type' in filters && filters.game_type !== 2) throw new Error('Recovery games target must use regular-season game_type 2');
  if ('snapshot_date' in filters) validateDate(filters.snapshot_date, 'Recovery snapshot_date');
  if ('stat_category' in filters && (typeof filters.stat_category !== 'string' || filters.stat_category.length === 0)) {
    throw new Error('Recovery stat_category must be a nonempty string');
  }
  return { table, filters: Object.fromEntries(spec.filterColumns.filter(filter => filter in filters).map(filter => [filter, filters[filter]])) };
}

function rowKey(spec, row) {
  const values = spec.keyColumns.map(column => row[column]);
  if (values.some(value => value === undefined || value === null || value === '')) throw new Error('Recovery row is missing a unique-key value');
  return JSON.stringify(values);
}

function assertRowMatchesTarget(target, row) {
  for (const [column, expected] of Object.entries(target.filters)) {
    if (row[column] !== expected) throw new Error(`Recovery row is outside requested ${column}: expected ${expected}, received ${row[column]}`);
  }
}

function stableRow(row) {
  return sortValue(row);
}

export function buildManifest(table, filters, rows, { fetch, provenance } = {}) {
  const target = validateTarget(table, filters);
  const spec = RECOVERY_TABLES[table];
  const allowedColumns = new Set(spec.selectColumns);
  if (!Array.isArray(rows)) throw new Error('Recovery rows must be an array');
  const seen = new Set();
  const duplicateKeys = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Recovery row must be an object');
    const unknownColumn = Object.keys(row).find(column => !allowedColumns.has(column));
    if (unknownColumn) throw new Error(`Recovery row contains unknown column: ${unknownColumn}`);
    const missingColumn = spec.compareColumns.find(column => !(column in row) || row[column] === undefined);
    if (missingColumn) throw new Error(`Recovery row is missing compare column: ${missingColumn}`);
    assertRowMatchesTarget(target, row);
    const key = rowKey(spec, row);
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }
  const manifest = {
    kind: 'puckiq-recovery-manifest',
    version: 1,
    target,
    key_columns: [...spec.keyColumns],
    row_columns: [...spec.selectColumns],
    row_count: rows.length,
    unique_row_count: seen.size,
    duplicate_keys: [...duplicateKeys].sort(),
    duplicate_key_count: duplicateKeys.size,
    complete: duplicateKeys.size === 0,
    rows: rows.map(stableRow).sort((left, right) => {
      const leftKey = rowKey(spec, left);
      const rightKey = rowKey(spec, right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    }),
  };
  if (fetch) manifest.fetch = sortValue(fetch);
  if (provenance) manifest.provenance = sortValue(provenance);
  return manifest;
}

export function assertCompleteManifest(manifest) {
  if (!manifest || manifest.kind !== 'puckiq-recovery-manifest' || manifest.version !== 1) throw new Error('Invalid recovery manifest');
  const target = validateTarget(manifest.target?.table, manifest.target?.filters);
  const spec = RECOVERY_TABLES[target.table];
  if (stableJson(manifest.key_columns) !== stableJson(spec.keyColumns)) throw new Error('Recovery manifest unique keys are not schema-backed');
  if (stableJson(manifest.row_columns) !== stableJson(spec.selectColumns)) throw new Error('Recovery manifest row columns are not allow-listed');
  if (manifest.complete !== true || manifest.duplicate_key_count !== 0 || manifest.duplicate_keys?.length !== 0) {
    throw new Error('Recovery manifest is incomplete or contains duplicate keys');
  }
  if (!Array.isArray(manifest.rows) || manifest.row_count !== manifest.rows.length || manifest.unique_row_count !== manifest.rows.length) {
    throw new Error('Recovery manifest row counts are inconsistent');
  }
  const rebuilt = buildManifest(target.table, target.filters, manifest.rows);
  if (rebuilt.duplicate_key_count !== 0 || rebuilt.unique_row_count !== rebuilt.row_count) throw new Error('Recovery manifest rows contain duplicate keys');
  if (manifest.fetch && manifest.fetch.verified !== true) throw new Error('Recovery manifest fetch is not verified complete');
  if (manifest.fetch && (manifest.fetch.declared_count !== manifest.row_count || manifest.fetch.fetched_count !== manifest.row_count || !Number.isInteger(manifest.fetch.page_count) || manifest.fetch.page_count < 1)) {
    throw new Error('Recovery manifest fetch counts are inconsistent');
  }
  return manifest;
}

export function compareManifests(reference, actual) {
  assertCompleteManifest(reference);
  assertCompleteManifest(actual);
  if (stableJson(reference.target) !== stableJson(actual.target)) throw new Error('Recovery manifests have different targets');
  if (stableJson(reference.key_columns) !== stableJson(actual.key_columns)) throw new Error('Recovery manifests have different unique keys');
  const spec = RECOVERY_TABLES[reference.target.table];
  const index = manifest => new Map(manifest.rows.map(row => [rowKey(spec, row), row]));
  const referenceRows = index(reference);
  const actualRows = index(actual);
  const changedKeys = [];
  const missingKeys = [];
  const staleKeys = [];
  const changedRows = [];
  const missingRows = [];
  const staleRows = [];
  for (const [key, referenceRow] of referenceRows) {
    if (!actualRows.has(key)) {
      missingKeys.push(key);
      missingRows.push({ key, row: referenceRow });
    } else if (stableJson(projectRow(spec, referenceRow)) !== stableJson(projectRow(spec, actualRows.get(key)))) {
      changedKeys.push(key);
      changedRows.push({ key, reference: referenceRow, actual: actualRows.get(key) });
    }
  }
  for (const [key, actualRow] of actualRows) {
    if (!referenceRows.has(key)) {
      staleKeys.push(key);
      staleRows.push({ key, row: actualRow });
    }
  }
  const sortKeys = keys => keys.sort();
  sortKeys(changedKeys);
  sortKeys(missingKeys);
  sortKeys(staleKeys);
  const sortRows = rows => rows.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  sortRows(changedRows);
  sortRows(missingRows);
  sortRows(staleRows);
  return {
    kind: 'puckiq-recovery-comparison',
    version: 1,
    target: reference.target,
    reference_count: reference.rows.length,
    actual_count: actual.rows.length,
    changed_count: changedKeys.length,
    missing_count: missingKeys.length,
    stale_count: staleKeys.length,
    changed_keys: changedKeys,
    missing_keys: missingKeys,
    stale_keys: staleKeys,
    changed_rows: changedRows,
    missing_rows: missingRows,
    stale_rows: staleRows,
    equal: changedKeys.length === 0 && missingKeys.length === 0 && staleKeys.length === 0,
    read_only: true,
    deletes_applied: false,
    applies_performed: false,
  };
}

function projectRow(spec, row) {
  return Object.fromEntries(spec.compareColumns.map(column => [column, row[column] === undefined ? null : row[column]]));
}

export async function fetchAllPages(fetchPage, { pageSize = 500, onPage } = {}) {
  if (typeof fetchPage !== 'function') throw new Error('Recovery page fetcher is required');
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('Recovery page size must be a positive integer');
  const rows = [];
  let expectedCount = null;
  for (let from = 0; ; from += pageSize) {
    let result;
    try {
      result = await fetchPage(from, from + pageSize - 1);
    } catch (error) {
      throw new Error(`Recovery fetch incomplete at page ${from}: ${error.message}`);
    }
    if (result?.error) throw new Error(`Recovery fetch incomplete at page ${from}: ${result.error.message ?? result.error}`);
    if (!Array.isArray(result?.data)) throw new Error(`Recovery fetch incomplete at page ${from}: missing row array`);
    if (!Number.isInteger(result.count) || result.count < 0) throw new Error('Recovery fetch must provide an exact server row count');
    if (expectedCount === null) expectedCount = result.count;
    if (result.count !== expectedCount) throw new Error('Recovery fetch returned inconsistent exact row counts');
    if (result.data.length > pageSize) throw new Error(`Recovery fetch returned more than page size at page ${from}`);
    rows.push(...result.data);
    onPage?.({ from, to: from + pageSize - 1, count: expectedCount, rows: result.data.length });
    if (rows.length > expectedCount) throw new Error('Recovery fetch returned more rows than its exact count');
    if (rows.length === expectedCount) break;
    if (result.data.length === 0 || result.data.length < pageSize) throw new Error(`Recovery fetch incomplete at page ${from}: page ended before exact count`);
  }
  if (rows.length !== expectedCount) throw new Error(`Recovery fetch incomplete: fetched ${rows.length} of ${expectedCount} rows`);
  return rows;
}

export function manifestJson(manifest) {
  return `${stableJson(manifest)}\n`;
}
