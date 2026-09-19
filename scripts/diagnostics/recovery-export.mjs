import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  RECOVERY_TABLES,
  buildManifest,
  fetchAllPages,
  manifestJson,
  validateTarget,
} from './recovery-manifest.mjs';

function loadEnv() {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function readOnlyConfig(env) {
  const serverUrl = env.SUPABASE_URL?.replace(/\/$/, '');
  const appUrl = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (serverUrl && appUrl && serverUrl !== appUrl) throw new Error('Supabase URLs must match.');
  const url = serverUrl || appUrl;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Read-only recovery requires SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return { url, key };
}

function usage() {
  return [
    'Usage: node scripts/diagnostics/recovery-export.mjs --table TABLE --season YYYYZZZZ [options]',
    '',
    'Tables: games, standings, skater_season_stats, goalie_season_stats, team_stat_categories',
    'Required options: --game-type 2 for games; --snapshot-date YYYY-MM-DD for standings',
    'Optional: --category NAME, --page-size N, --out FILE',
    'Reads only allow-listed public hockey columns with the app anon key. Never writes Supabase.',
  ].join('\n');
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1];
  const prefix = `${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

function hasOption(args, name) {
  return args.includes(name) || args.some(arg => arg.startsWith(`${name}=`));
}

function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return null;
  }
  const table = option(args, '--table');
  const rawSeason = option(args, '--season');
  if (!table || !rawSeason || !/^\d{8}$/.test(rawSeason)) throw new Error('Use --table and an eight-digit --season');
  const filters = { season: Number(rawSeason) };
  if (table === 'games') {
    const rawGameType = option(args, '--game-type');
    if (!rawGameType) throw new Error('Games recovery requires --game-type 2');
    filters.game_type = Number(rawGameType);
  }
  if (table === 'standings') {
    filters.snapshot_date = option(args, '--snapshot-date');
    if (!filters.snapshot_date) throw new Error('Standings recovery requires --snapshot-date YYYY-MM-DD');
  }
  if (hasOption(args, '--category')) filters.stat_category = option(args, '--category');
  const pageSize = option(args, '--page-size') === undefined ? 500 : Number(option(args, '--page-size'));
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('--page-size must be a positive integer');
  const out = option(args, '--out');
  const allowed = new Set(['--help', '-h', '--table', '--season', '--game-type', '--snapshot-date', '--category', '--page-size', '--out']);
  for (const arg of args) {
    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (name.startsWith('-') && !allowed.has(name)) throw new Error(`Unknown option: ${arg}`);
  }
  return { table, filters: validateTarget(table, filters).filters, pageSize, out };
}

export async function exportRows({ table, filters, pageSize = 500, client: providedClient, sourceUrl: providedSourceUrl, exportedAt = new Date().toISOString() }) {
  let client = providedClient;
  let sourceUrl = providedSourceUrl;
  if (!client) {
    loadEnv();
    const config = readOnlyConfig(process.env);
    client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    sourceUrl = config.url;
  }
  if (!sourceUrl) throw new Error('Recovery export source URL is required for provenance');
  const exportedDate = new Date(exportedAt);
  if (!Number.isFinite(exportedDate.getTime()) || exportedDate.toISOString() !== exportedAt) throw new Error('Recovery export timestamp must be an exact ISO timestamp');
  const spec = RECOVERY_TABLES[table];
  let pageCount = 0;
  let declaredCount = null;
  const rows = await fetchAllPages(async (from, to) => {
    let query = client.from(table).select(spec.selectColumns.join(','), { count: 'exact' });
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    for (const column of spec.keyColumns) query = query.order(column, { ascending: true });
    return query.range(from, to);
  }, {
    pageSize,
    onPage(page) {
      pageCount += 1;
      declaredCount = page.count;
    },
  });
  return buildManifest(table, filters, rows, {
    fetch: {
      verified: true,
      page_count: pageCount,
      declared_count: declaredCount,
      fetched_count: rows.length,
    },
    provenance: {
      atomic_snapshot: false,
      export_type: 'paginated_read',
      exported_at: exportedAt,
      source_url: sourceUrl,
    },
  });
}

async function writeOutput(output, out) {
  const serialized = manifestJson(output);
  if (out) {
    await writeFile(out, serialized, { encoding: 'utf8', flag: 'wx' });
    console.error(`[recovery-export] Read-only export complete: ${out}`);
  } else {
    process.stdout.write(serialized);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) return;
  const manifest = await exportRows(parsed);
  if (!manifest.complete || manifest.fetch?.verified !== true || manifest.row_count !== manifest.fetch.fetched_count || manifest.fetch.declared_count !== manifest.row_count) {
    throw new Error('Recovery export did not prove complete fetch and unique-key coverage');
  }
  await writeOutput(manifest, parsed.out);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[recovery-export] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
