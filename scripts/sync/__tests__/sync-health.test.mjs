import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHealth, resolveDataSeason } from '../health-contract.mjs';

const now = new Date('2026-09-10T12:00:00Z');
const season = 20252026;
const core = ['games', 'standings', 'player_stats', 'stat_categories'];
const tables = ['games', 'standings', 'skater_season_stats', 'goalie_season_stats', 'team_stat_categories', 'teams', 'players'].map(table => ({table,count:32}));
const runs = core.map(sync_type => ({sync_type,status:'completed',started_at:'2026-09-10T10:00:00Z',completed_at:'2026-09-10T10:01:00Z',metadata:{season:sync_type==='games'?20262027:season}}));
const report = overrides => evaluateHealth({calendarSeason:20262027,dataSeason:season,tables,runs,now,...overrides});
test('offseason uses explicit stored period, without inventing current-season games', () => {
  assert.equal(resolveDataSeason(20262027,[{season:20252026},{season:20242025}]),season);
  assert.equal(report().ok,true);
  assert.equal(report().dataSeason,season);
  assert.equal(resolveDataSeason(20262027,[{season:20272028},{season:null}]),null);
});
test('empty/missing tables fail rather than returning successful health', () => {
  assert.equal(report({tables:tables.map(t=>t.table==='standings'?{...t,count:0}:t)}).ok,false);
  assert.equal(report({tables:tables.map(t=>t.table==='games'?{...t,error:'missing table'}:t)}).ok,false);
  assert.equal(report({dataSeason:null}).ok,false);
});
test('old syncs and unknown periods are unhealthy even with populated tables', () => {
  assert.equal(report({runs:runs.map(r=>({...r,completed_at:'2026-05-04T12:00:00Z'}))}).ok,false);
  assert.equal(report({runs:runs.map(r=>({...r,metadata:null}))}).ok,false);
});
test('newer failed or stuck runs cannot be hidden by a prior completed run', () => {
  assert.equal(report({runs:[...runs,{...runs[0],status:'failed',started_at:'2026-09-10T11:00:00Z',completed_at:'2026-09-10T11:01:00Z'}]}).ok,false);
  assert.equal(report({runs:[...runs,{...runs[0],status:'running',started_at:'2026-09-10T10:30:00Z',completed_at:null}]}).ok,false);
  assert.equal(report({runs:[...runs,{...runs[0],status:'running',started_at:'2026-01-01T00:00:00Z',completed_at:null}]}).ok,true);
});
test('future/invalid timestamps and mismatched periods are not fresh successes', () => {
  for(const completed_at of ['invalid','2026-09-11T12:00:00Z']) assert.equal(report({runs:runs.map(r=>({...r,completed_at}))}).ok,false);
  assert.equal(report({runs:runs.map(r=>({...r,metadata:{season:20242025}}))}).ok,false);
});
test('fresh polling cannot hide stale or prior-season standings during regular-season games', () => {
  const active = {calendarSeason:season,gameSyncSeason:season,activeRegularSeason:true,now:new Date('2026-01-20T12:00:00Z')};
  const freshRuns = runs.map(r=>({...r,started_at:'2026-01-20T10:00:00Z',completed_at:'2026-01-20T10:01:00Z',metadata:{season,snapshot_date:'2026-01-20'}}));
  assert.equal(report({...active,runs:freshRuns}).ok,true);
  assert.equal(report({...active,runs:freshRuns.map(r=>({...r,metadata:{...r.metadata,snapshot_date:'2026-01-01'}}))}).ok,false);
  assert.equal(report({...active,dataSeason:20242025,runs:freshRuns}).ok,false);
  assert.equal(report({activeRegularSeason:false}).ok,true);
});
test('a historical repair is not judged against today\'s active-season snapshot date', () => {
  const historical=20242025;
  const historicalRuns=runs.map(r=>({...r,metadata:{season:historical,snapshot_date:'2025-04-17'}}));
  assert.equal(report({calendarSeason:season,dataSeason:historical,gameSyncSeason:historical,activeRegularSeason:true,runs:historicalRuns}).ok,true);
});
