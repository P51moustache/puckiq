import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStandingsSnapshot } from '../standings-contract.mjs';
const season = 20252026;
const teams = ['EDM','TOR'];
const rows = teams.map(abbrev => ({teamAbbrev:{default:abbrev},seasonId:season,date:'2026-04-17',gamesPlayed:82,wins:42,losses:30,otLosses:10,points:94,goalFor:280,goalAgainst:260}));
test('standings require complete, unique club coverage and a valid source date', () => {
  assert.equal(validateStandingsSnapshot(rows,season,teams),'2026-04-17');
  assert.throws(()=>validateStandingsSnapshot(rows.slice(1),season,teams),/coverage/);
  assert.throws(()=>validateStandingsSnapshot([rows[0],rows[0]],season,teams),/Duplicate/);
  assert.throws(()=>validateStandingsSnapshot([{...rows[0],seasonId:20242025},rows[1]],season,teams));
});
test('standings never turn missing core totals into zero or publish contradictory records', () => {
  for (const change of [{wins:null},{points:-1},{gamesPlayed:81},{points:95},{goalFor:NaN}]) {
    assert.throws(()=>validateStandingsSnapshot([{...rows[0],...change},rows[1]],season,teams));
  }
});
test('historical standings use the source season end date rather than empty June 30 results', async () => {
  const { standingsRequestDate } = await import('../standings-contract.mjs');
  const catalog = {seasons:[{id:season,standingsStart:'2025-10-07',standingsEnd:'2026-04-17'}]};
  assert.equal(standingsRequestDate(catalog,season,'2026-09-10'),'2026-04-17');
  assert.equal(standingsRequestDate(catalog,season,'2026-01-20'),'2026-01-20');
  assert.throws(()=>standingsRequestDate(catalog,season,'2025-09-10'),/not started/);
  assert.throws(()=>standingsRequestDate(catalog,20242025,'2026-09-10'),/catalog/);
});
