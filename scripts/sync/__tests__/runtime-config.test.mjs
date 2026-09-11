import test from 'node:test';
import assert from 'node:assert/strict';
import { writerConfig, childInvocation, syncPeriods } from '../runtime-config.mjs';
test('write clients require a server key and never fall back to anon', () => {
  assert.throws(()=>writerConfig({EXPO_PUBLIC_SUPABASE_URL:'https://example.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'public'}),/SERVICE_ROLE/);
  assert.deepEqual(writerConfig({SUPABASE_URL:'https://server.supabase.co',EXPO_PUBLIC_SUPABASE_URL:'https://server.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server'}),{url:'https://server.supabase.co',key:'server'});
  assert.throws(()=>writerConfig({SUPABASE_URL:'https://one.supabase.co',EXPO_PUBLIC_SUPABASE_URL:'https://two.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server'}),/match/);
});
test('child runner uses separate arguments and a caller-provided executable', () => {
  assert.deepEqual(childInvocation('/usr/bin/node','/tmp/my app/sync.mjs',['--season','20252026']),{command:'/usr/bin/node',args:['/tmp/my app/sync.mjs','--season','20252026']});
});
test('offseason can refresh next season games while keeping stats in their actual source season', () => {
  assert.deepEqual(syncPeriods(20262027,[{seasonId:20252026,date:'2026-04-17'}]),{games:20262027,stats:20252026});
  assert.throws(()=>syncPeriods(20262027,[{seasonId:20272028,date:'2027-04-17'}]));
  assert.throws(()=>syncPeriods(20262027,[{seasonId:20252026,date:'2026-04-17'},{seasonId:20242025,date:'2025-04-17'}]));
});
