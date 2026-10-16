import { buildSkaterForm } from '../form';
import { likelyRosteredIds, type PickupCandidate } from '../pickups';
import { quickPickGroup, quickPickGroups } from '../quickPick';
import type { LineupSlots } from '../../../types/fantasy';

const skater = (id: number, position: string, rate: number): PickupCandidate => ({
  playerId: id, name: `S${id}`, team: 'TOR', position,
  form: { ...buildSkaterForm(id, {}), seasonRate: rate, value: rate },
});
const goalie = (id: number, share: number): PickupCandidate => ({
  playerId: id, name: `G${id}`, team: 'BOS', position: 'G',
  form: { ...buildSkaterForm(id, {}), isGoalie: true, startShare: share, seasonRate: 5, value: 5 * share },
});
// 2 teams × (1 skater slot + 3 bench) = 8 skaters; 2 × (1 + 1) = 4 goalies.
const tiny: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 1 };

describe('quickPickGroup', () => {
  it('puts every forward position in F', () => {
    expect(['C', 'L', 'LW', 'R', 'RW'].map(quickPickGroup)).toEqual(['F', 'F', 'F', 'F', 'F']);
    expect(quickPickGroup('D')).toBe('D');
    expect(quickPickGroup('G')).toBe('G');
    expect(quickPickGroup('')).toBeNull();
  });
});

describe('quickPickGroups', () => {
  const pool = [
    skater(1, 'D', 3),
    skater(2, 'C', 9),
    skater(3, 'L', 7),
    skater(4, 'D', 8),
    ...Array.from({ length: 8 }, (_, i) => skater(10 + i, 'R', 1 - i * 0.1)),
    ...Array.from({ length: 6 }, (_, i) => goalie(20 + i, 0.9 - i * 0.1)),
  ];

  it('lists the owned players by position, most-owned first', () => {
    const groups = quickPickGroups(pool, tiny, 2);
    expect(groups.F.map((p) => p.playerId)).toEqual([2, 3, 10, 11, 12, 13]);
    expect(groups.D.map((p) => p.playerId)).toEqual([4, 1]);
    expect(groups.G.map((p) => p.playerId)).toEqual([20, 21, 22, 23]);
    expect(groups.F[0]).toEqual({ playerId: 2, name: 'S2', teamAbbrev: 'TOR', position: 'C', active: true });
  });

  it('matches the Pickups ownership cut exactly', () => {
    const groups = quickPickGroups(pool, tiny, 2);
    const listed = new Set([...groups.F, ...groups.D, ...groups.G].map((p) => p.playerId));
    expect(listed).toEqual(likelyRosteredIds(pool, 2, tiny));
  });

  it('skips players without a known position', () => {
    const groups = quickPickGroups([skater(1, '', 9)], tiny, 2);
    expect(groups).toEqual({ F: [], D: [], G: [] });
  });
});
