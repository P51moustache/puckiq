# Safe core-data recovery tooling

Date: September 12, 2026. This is read-only recovery preparation, not a production repair or
backup replacement.

## Purpose and safety boundary

The tooling inventories and exports only allow-listed public hockey rows for one exact target
period, then compares two completed JSON manifests. It never reads user, subscription,
notification, push-token, ML, or other non-core data, and it has no Supabase insert, update,
upsert, delete, RPC, migration, scheduler, deployment, or restore path.

The live catalog review verified these unique keys:

| Table | Verified unique key | Required target period |
| --- | --- | --- |
| `games` | `id` | `season` plus regular-season `game_type=2` |
| `standings` | `team_abbrev, season, snapshot_date` | `season` plus exact source `snapshot_date` |
| `skater_season_stats` | `player_id, season, team_abbrev` | `season` |
| `goalie_season_stats` | `player_id, season, team_abbrev` | `season` |
| `team_stat_categories` | `team_abbrev, season, stat_category` | `season`, optionally one category |

Tables outside this list are intentionally unsupported. The tool rejects rows whose season or
other target-period column differs from the requested target. For standings, the source snapshot
date is mandatory; the fetch date is never substituted.

## Read-only export

Use the app's anon key so RLS remains the boundary. Do not provide or print a service-role key.
The command requests an exact server count, fetches deterministic ordered pages, and fails if all
pages do not reconcile to that count. It also fails on duplicate verified keys. A JSON file is
written only after those checks pass; `--out` uses create-only semantics and will not overwrite an
existing file.

```sh
node scripts/diagnostics/recovery-export.mjs \
  --table games --season 20252026 --game-type 2 \
  --out /tmp/puckiq-games-20252026.json

node scripts/diagnostics/recovery-export.mjs \
  --table standings --season 20252026 --snapshot-date 2026-04-17 \
  --out /tmp/puckiq-standings-20252026-2026-04-17.json

node scripts/diagnostics/recovery-export.mjs \
  --table skater_season_stats --season 20252026 \
  --out /tmp/puckiq-skaters-20252026.json
```

The exporter reads `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` from the environment or the local gitignored `.env`. It emits a
machine-readable manifest containing the target, key columns, allow-listed row columns, row and
duplicate counts, sorted rows, and verified fetch counts. It does not claim success from row count
alone: `complete`, `fetch.verified`, `declared_count`, `fetched_count`, target guards, and unique
keys must all pass. Each exporter manifest also records the nonsecret `source_url`, an
`exported_at` timestamp, `export_type: paginated_read`, and `atomic_snapshot: false`.

The target's season and source period identify the hockey data being inspected; `exported_at`
identifies when the paginated export was produced. Pages are ordered and count-checked, but the
tool makes no claim that they came from one atomic database snapshot.

## Live verification

On September 12, 2026, the reviewed exporter was run against the live project in read-only mode.
The five manifests are preserved at `/tmp/puckiq-recovery-20260912.hhTXlk`:

| Scope | Rows | Pages |
| --- | ---: | ---: |
| `games`, regular season (`game_type=2`) | 1,312 | 3 |
| `standings`, snapshot `2026-05-04` | 32 | 1 |
| `skater_season_stats`, season `20252026` | 979 | 2 |
| `goalie_season_stats`, season `20252026` | 98 | 1 |
| `team_stat_categories`, season `20252026` | 576 | 2 |

Count, unique-key, and fetch-completeness validation passed for every scope. Each manifest also
self-compared successfully. This verifies the exporter against live reads only; it is not a full
database backup, not an atomic database snapshot, and does not compare against an independent NHL
reference source.

## Comparison

Comparison is local-only. `--reference` is the reviewed/source-side manifest and `--actual` is the
stored-row manifest. The result classifies:

- `changed_keys`: the same verified key exists on both sides with different semantic values;
- `missing_keys`: present in the reference but absent from actual;
- `stale_keys`: present in actual but absent from the reference.

The result also includes `changed_rows` with both row versions, plus `missing_rows` and
`stale_rows` with the relevant row payload, so review does not depend on counts alone.

```sh
node scripts/diagnostics/recovery-compare.mjs \
  --reference /path/to/reviewed-source.json \
  --actual /tmp/puckiq-games-20252026.json \
  --out /tmp/puckiq-games-20252026-comparison.json
```

Both manifests must be complete and have identical targets and schema-backed keys. The comparison
recomputes unique-key coverage instead of trusting metadata. Its output explicitly reports
`read_only: true`, `deletes_applied: false`, and `applies_performed: false`. A valid comparison
exits zero even when differences are found; invalid, incomplete, mismatched, or unreadable input
exits nonzero. Differences require parent review and a separately prepared manifest before any
future repair operation.

## Restore limitations

These JSON row exports are not full restorable database backups. They do not contain database
roles, schemas, constraints, indexes, RLS policies, triggers, views, sequences, WAL/PITR state,
transaction boundaries, or user/private data. Surrogate IDs and audit timestamps are intentionally
not a restore contract for the season-stat and category tables. There is currently no verified
backup, PITR, preview branch, local staging database, or database password available for this
project. Keep exports immutable and preserve them separately before any parent-reviewed repair.

This tooling therefore stops at evidence: inventory, exact-period export, and comparison. It does
not perform catalog repair, deletion, replacement, application, or production verification.

## NHL club-stats comparison

On September 12, 2026, all 32 clubs were fetched from the exact regular-season endpoints
`https://api-web.nhle.com/v1/club-stats/{team}/20252026/2` with bounded concurrency of 4 and a
15-second request timeout. Each payload was validated with
`scripts/sync/ingestion-contracts.mjs::normalizeClubStats`; no sync writer was executed.

Source coverage was complete at 32/32 clubs, with 1,023 skater rows and 100 goalie rows, and zero
source duplicate keys. Compared with the live stored exports in
`/tmp/puckiq-recovery-20260912.hhTXlk`:

| Group | Source | Stored | Changed | Missing from stored | Extra/stale in stored |
| --- | ---: | ---: | ---: | ---: | ---: |
| Skaters | 1,023 | 979 | 978 | 45 | 1 |
| Goalies | 100 | 98 | 97 | 3 | 1 |

The comparison uses every allow-listed semantic field, not counts alone. For example, skater key
`[8470613,20252026,"COL"]` has source `82 GP / 12 G / 23 A / 35 P` versus stored `1 GP / 0 G /
0 A / 0 P`; goalie key `[8471734,20252026,"NYR"]` has source `0.891207 save_pctg / 85,080
toi_seconds / 2 OT losses` versus stored `null / 67,359 / 0`. The stale stored keys are
`[8479383,20252026,"MIN"]` for skaters and `[8480051,20252026,"CAR"]` for goalies. Exact missing
keys, all changed row payloads, and field-level frequencies are in the comparison artifacts.

Artifacts from this read-only check are preserved at `/tmp/puckiq-recovery-20260912.hhTXlk`:

- `nhl-source-skaters-20252026.json` and `nhl-source-goalies-20252026.json`;
- `nhl-vs-stored-skaters-comparison.json` and `nhl-vs-stored-goalies-comparison.json`;
- `nhl-vs-stored-summary.json` with team coverage and mismatch frequencies.

This source aggregate is 32 independent HTTP reads, not an atomic NHL or database snapshot. The
stored JSON exports are not backups. No remote writes, repair applies, or source-side completeness
claim beyond the verified 32/32 fetch and normalization coverage was made.
