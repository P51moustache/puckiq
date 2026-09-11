import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
const { syncStandings } = await import('../sync-standings.mjs');
const { ALL_TEAMS } = await import('../nhl-api.mjs');
const season = 20252026;
const standings = ALL_TEAMS.map(abbrev=>({teamAbbrev:{default:abbrev},seasonId:season,date:'2026-04-17',gamesPlayed:0,wins:0,losses:0,otLosses:0,points:0,goalFor:0,goalAgainst:0}));
test('a failed standings request records a failed attempt instead of leaving the old success current', async () => {
  const logs=[];
  const client={from(table){assert.equal(table,'sync_log');return {async insert(entry){logs.push(entry);return {error:null};}};}};
  await assert.rejects(syncStandings(season,{client,fetcher:async()=>{throw new Error('source unavailable');}}),/source unavailable/);
  assert.equal(logs.length,1);
  assert.equal(logs[0].status,'failed');
  assert.equal(logs[0].records_processed,0);
  assert.ok(Date.parse(logs[0].started_at)<=Date.parse(logs[0].completed_at));
});
test('an unsuccessful standings write records zero processed rows and cannot become completed', async () => {
  const logs=[];
  const client={from(table){
    if(table==='teams') return {async select(){return {data:ALL_TEAMS.map((abbrev,i)=>({abbrev,id:i+1})),error:null};}};
    if(table==='standings') return {async upsert(){return {error:{message:'write rejected'}};}};
    assert.equal(table,'sync_log');return {async insert(entry){logs.push(entry);return {error:null};}};
  }};
  await assert.rejects(syncStandings(season,{client,fetcher:async url=>url.endsWith('standings-season') ? {seasons:[{id:season,standingsStart:'2025-10-07',standingsEnd:'2026-04-17'}]} : {standings}}),/write rejected/);
  assert.equal(logs[0].status,'failed');
  assert.equal(logs[0].records_processed,0);
});
