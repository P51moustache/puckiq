import { createTeam } from '../../teams';
import { player } from '../../fantasy/__tests__/fixtures';
import { parseRosterSnapshot, rosterBrief, rosterSnapshot, type RosterSnapshot } from '../rosterBrief';
import { RosterBriefStore } from '../RosterBriefStore';

const team = createTeam({ players: [player(8478402, 'Center', 'EDM', 'C'), player(8478048, 'Goalie', 'NYR', 'G')] });
const now = Date.parse('2026-10-13T16:00:00Z');
const baseline: RosterSnapshot = { schema: 1, date: '2026-10-13', checkedAt: now - 1000, players: [{ id: 8478402, signal: 'ok', confidence: 'unknown', goalie: null }, { id: 8478048, signal: 'unknown', confidence: 'unknown', goalie: 'likely' }], empty: { D: 0 } };
const current = (overrides: Partial<RosterSnapshot> = {}): RosterSnapshot => ({ ...baseline, checkedAt: now, ...overrides });

it('stays quiet on first visit, unchanged, future and stale observations', () => {
  expect(rosterBrief(null, current(), team)).toEqual([]);
  expect(rosterBrief(baseline, current(), team)).toEqual([]);
  expect(rosterBrief(current({ checkedAt: now + 1 }), current(), team)).toEqual([]);
  expect(rosterBrief({ ...baseline, checkedAt: now - 15 * 86400000 }, current(), team)).toEqual([]);
});

it('labels confirmed scratches separately from injury news and goalie estimates', () => {
  const scratch = current({ players: [{ ...baseline.players[0], signal: 'scratch', confidence: 'confirmed' }, { ...baseline.players[1], goalie: 'unlikely' }], empty: { D: 1 } });
  const items = rosterBrief(baseline, scratch, team);
  expect(items.map((item) => item.kind)).toEqual(['scratch', 'goalie_outlook', 'slot_gap']);
  expect(items[0].detail).toContain('Confirmed for Oct 13');
  expect(items[1].detail).toContain('not a confirmed starter');
  const injury = current({ players: [{ ...baseline.players[0], signal: 'dtd', confidence: 'likely' }] });
  expect(rosterBrief(baseline, injury, team)[0]).toMatchObject({ kind: 'injury_report' });
  expect(rosterBrief(baseline, injury, team)[0].detail).toContain('not an NHL confirmation');
});

it('does not invent recovery, new-player changes or compare goalie estimates across dates', () => {
  const injured = { ...baseline, players: [{ ...baseline.players[0], signal: 'dtd' as const, confidence: 'likely' as const }] };
  expect(rosterBrief(injured, current(), team)).toEqual([]);
  const newPlayer = current({ players: [{ id: 8480000, signal: 'scratch', confidence: 'confirmed', goalie: null }] });
  expect(rosterBrief(baseline, newPlayer, team)).toEqual([]);
  const next = current({ date: '2026-10-14', players: [{ ...baseline.players[1], goalie: 'unlikely' }], empty: { C: 1 } });
  expect(rosterBrief(baseline, next, team).map((item) => item.kind)).toEqual(['slot_gap']);
});

it('stores categorical local observations without names or raw news', () => {
  const snapshot = rosterSnapshot({ team, date: baseline.date, checkedAt: now, statuses: new Map(), goalies: new Map(), empty: ['D', 'D'] });
  expect(snapshot.empty.D).toBe(2);
  expect(snapshot.players[0]).toEqual({ id: 8478402, signal: 'unknown', confidence: 'unknown', goalie: null });
  expect(JSON.stringify(snapshot)).not.toContain('Center');
  expect(parseRosterSnapshot(JSON.stringify(snapshot), now)).toEqual(snapshot);
});

it.each([
  '{', 'null', JSON.stringify({ ...baseline, date: '2026-02-30' }),
  JSON.stringify({ ...baseline, checkedAt: now + 1 }), JSON.stringify({ ...baseline, checkedAt: -1 }),
  JSON.stringify({ ...baseline, players: [baseline.players[0], baseline.players[0]] }),
  JSON.stringify({ ...baseline, empty: { D: -1 } }),
  JSON.stringify({ ...baseline, players: [{ ...baseline.players[0], signal: 'healthy' }] }), 'x'.repeat(20001),
])('rejects malformed local observations', (raw) => {
  expect(parseRosterSnapshot(raw, now)).toBeNull();
});

it('keeps a newer in-memory save when an old disk read completes late', async () => {
  let complete!: (raw: string) => void;
  const storage = { getItem: jest.fn(() => new Promise<string>((resolve) => { complete = resolve; })), setItem: jest.fn(async () => undefined) };
  const store = new RosterBriefStore(storage, () => now);
  const loading = store.load(team.id);
  await store.save(team.id, current());
  complete(JSON.stringify(baseline));
  expect(await loading).toEqual(current());
});

it('serializes writes and recovers after a storage failure', async () => {
  const storage = { getItem: jest.fn(async () => { throw new Error('unavailable'); }), setItem: jest.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined) };
  const store = new RosterBriefStore(storage, () => now);
  expect(await store.load(team.id)).toBeNull();
  const old = store.save(team.id, baseline).catch(() => undefined);
  const latest = store.save(team.id, current());
  await Promise.all([old, latest]);
  expect(storage.setItem.mock.calls.map((call) => JSON.parse(call[1]).checkedAt)).toEqual([baseline.checkedAt, now]);
  expect(await store.load(team.id)).toEqual(current());
});
