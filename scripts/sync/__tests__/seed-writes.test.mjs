import test from 'node:test';
import assert from 'node:assert/strict';
// Construct the real helper with non-sensitive test configuration, then replace
// its query boundary before any operation. These tests never contact a database.
process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
const {supabase,batchUpsert,startSync,completeSync} = await import('../../seed-utils.mjs');
const failure = {data:null,error:{message:'write denied'}};
test('legacy batch writer throws instead of treating an unsuccessful batch as success',async()=>{
  supabase.from=()=>({upsert:async()=>failure});
  await assert.rejects(()=>batchUpsert('skater_season_stats',[{player_id:1}], 'player_id'),/write denied/);
});
test('creating or completing a sync log must check the database result',async()=>{
  const q={insert:()=>q,select:()=>q,single:async()=>failure,update:()=>q,eq:async()=>failure};
  supabase.from=()=>q;
  await assert.rejects(()=>startSync('test'),/write denied/);
  await assert.rejects(()=>completeSync(1,2),/write denied/);
});
