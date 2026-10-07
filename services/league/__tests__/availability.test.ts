import { roomCoverage, rosterAgeHours, STALE_ROSTER_HOURS, staleMembers, takenPlayerIds } from '../availability';
import { member, ME, NOW, player, snapshotOf } from './fixtures';

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

const mine = member(ME, 'Zach Attack', [player(8470001, 'Mine', 'EDM', 'C')]);
const ben = member('u-ben', 'Ben’s Bombers', [
  player(8470101, 'Ben Centre', 'VAN', 'C'),
  player(8470102, 'Ben On IR', 'VAN', 'D', { injuredReserve: true }),
]);
const sam = member('u-sam', 'Sam’s Snipers', [player(8470201, 'Sam Goalie', 'TOR', 'G')]);
const ghost = member('u-ghost', 'Ghost Team', []);

describe('takenPlayerIds', () => {
  it('collects every other member’s players, IR included, never mine', () => {
    expect([...takenPlayerIds(snapshotOf([mine, ben, sam]))].sort()).toEqual([8470101, 8470102, 8470201]);
  });

  it('is empty when I’m alone in the room', () => {
    expect(takenPlayerIds(snapshotOf([mine])).size).toBe(0);
  });
});

describe('roomCoverage', () => {
  it('counts joined members, synced rosters and the league size', () => {
    expect(roomCoverage(snapshotOf([mine, ben, ghost]))).toEqual({ joined: 3, synced: 2, leagueSize: 10 });
  });
});

describe('staleMembers', () => {
  const snapshot = snapshotOf([
    member(ME, 'Zach Attack', [], { rosterUpdatedAt: hoursAgo(100) }),
    member('u-fresh', 'Fresh', [], { rosterUpdatedAt: hoursAgo(10) }),
    member('u-old', 'Old', [], { rosterUpdatedAt: hoursAgo(72) }),
    member('u-older', 'Older', [], { rosterUpdatedAt: hoursAgo(96) }),
    member('u-broken', 'Broken', [], { rosterUpdatedAt: 'not a date' }),
  ]);

  it('lists other members past the limit, oldest (or unreadable) first, never me', () => {
    expect(staleMembers(snapshot, NOW).map((row) => row.userId)).toEqual(['u-broken', 'u-older', 'u-old']);
  });

  it('takes a custom limit', () => {
    expect(staleMembers(snapshot, NOW, 80).map((row) => row.userId)).toEqual(['u-broken', 'u-older']);
  });

  it('defaults to two days and is empty for a fresh room', () => {
    expect(STALE_ROSTER_HOURS).toBe(48);
    expect(staleMembers(snapshotOf([mine, ben]), NOW)).toEqual([]);
  });
});

describe('rosterAgeHours', () => {
  it('measures hours since the last push, never negative', () => {
    expect(rosterAgeHours({ rosterUpdatedAt: hoursAgo(5) }, NOW)).toBeCloseTo(5);
    expect(rosterAgeHours({ rosterUpdatedAt: hoursAgo(-3) }, NOW)).toBe(0);
    expect(rosterAgeHours({ rosterUpdatedAt: '' }, NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});
