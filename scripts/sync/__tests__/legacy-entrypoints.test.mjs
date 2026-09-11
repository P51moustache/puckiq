import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('retired broad stat-category recovery fails with the maintained replacement', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../seed-stat-categories.mjs', import.meta.url))], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_URL: '',
    },
  });

  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /retired/i);
  assert.match(`${result.stdout}${result.stderr}`, /sync-stat-categories\.mjs/);
});
