import type { FantasyPlayer } from '../../../types/fantasy';
import { findTrades, type TradeIdea } from '../trades';
import { busyNight, game, player, slotsOf, week } from './fixtures';

const MON = '2026-10-12';
const slots = slotsOf({ C: 2, D: 2 });

/** EDM and VAN play each other Monday, Wednesday and Friday. */
function threeNightWeek(monday: string, dates: string[]) {
  return week(monday, Object.fromEntries(dates.map((date) => [date, [game(date, 'EDM', 'VAN'), ...busyNight(date)]])));
}
const thisWeek = threeNightWeek(MON, ['2026-10-12', '2026-10-14', '2026-10-16']);
const nextWeek = threeNightWeek('2026-10-19', ['2026-10-19', '2026-10-21', '2026-10-23']);

const GRADED = [3, 2.5, 2, 1.5, 1];
const myCentres = GRADED.map((_, index) => player(8470001 + index, `C${index + 1}`, 'EDM', 'C'));
const theirDs = GRADED.map((_, index) => player(8470101 + index, `D${index + 1}`, 'VAN', 'D'));

function valueMap(...groups: [FantasyPlayer[], number[]][]): Map<number, number> {
  return new Map(groups.flatMap(([players, values]) => players.map((p, index): [number, number] => [p.playerId, values[index]])));
}
const values = valueMap([myCentres, GRADED], [theirDs, GRADED]);

const summary = (ideas: TradeIdea[]) => ideas.map((idea) => [idea.give.playerName, idea.get.playerName, idea.myGain, idea.theirGain]);

describe('findTrades', () => {
  it('swaps my spare centres for their spare defencemen, best for both sides first', () => {
    // Five C and no D vs five D and no C, with 2 C + 2 D slots: every swap fills an empty slot on
    // both sides. Giving a top-two player costs his drop-off to the next man up each night.
    const ideas = findTrades({ mine: myCentres, theirs: theirDs, slots, values, schedules: [thisWeek], today: MON });
    expect(summary(ideas)).toEqual([
      ['C1', 'D1', 6, 6],
      ['C2', 'D2', 6, 6],
      ['C3', 'D3', 6, 6],
      ['C1', 'D2', 4.5, 7.5],
      ['C2', 'D1', 7.5, 4.5],
    ]);
  });

  it('never suggests a swap only one side wins', () => {
    const mine = [player(8470001, 'My C1', 'EDM', 'C'), player(8470002, 'My C2', 'EDM', 'C'), player(8470003, 'My D1', 'EDM', 'D'), player(8470004, 'My D2', 'EDM', 'D')];
    const theirs = [player(8470101, 'Their C1', 'VAN', 'C'), player(8470102, 'Their C2', 'VAN', 'C'), player(8470103, 'Their D1', 'VAN', 'D'), player(8470104, 'Their D2', 'VAN', 'D')];
    const balanced = valueMap([mine, [3, 1, 2, 1]], [theirs, [2, 2, 1, 3]]);
    expect(findTrades({ mine, theirs, slots, values: balanced, schedules: [thisWeek], today: MON })).toEqual([]);
  });

  it('never offers or asks for IR players', () => {
    const mine = myCentres.map((p, index) => (index === 0 ? { ...p, injuredReserve: true } : p));
    const theirs = theirDs.map((p, index) => (index === 0 ? { ...p, injuredReserve: true } : p));
    const ideas = findTrades({ mine, theirs, slots, values, schedules: [thisWeek], today: MON, limit: 50 });
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.some((idea) => idea.give.playerName === 'C1' || idea.get.playerName === 'D1')).toBe(false);
  });

  it('respects the minimum gain and the limit', () => {
    const base = { mine: myCentres, theirs: theirDs, slots, values, schedules: [thisWeek], today: MON };
    expect(summary(findTrades({ ...base, minGain: 6 }))).toEqual([
      ['C1', 'D1', 6, 6],
      ['C2', 'D2', 6, 6],
      ['C3', 'D3', 6, 6],
    ]);
    expect(findTrades({ ...base, minGain: 6.5 })).toEqual([]);
    expect(findTrades({ ...base, limit: 2 })).toHaveLength(2);
  });

  it('adds up every schedule and skips days before today', () => {
    const twoWeeks = findTrades({ mine: myCentres, theirs: theirDs, slots, values, schedules: [thisWeek, nextWeek], today: MON });
    expect(summary(twoWeeks)[0]).toEqual(['C1', 'D1', 12, 12]);
    const fromWednesday = findTrades({ mine: myCentres, theirs: theirDs, slots, values, schedules: [thisWeek], today: '2026-10-14' });
    expect(summary(fromWednesday)[0]).toEqual(['C1', 'D1', 4, 4]);
  });

  it('gives the same answer when a negative value turns pruning off', () => {
    const benchWarmer = player(8470099, 'Never Plays', 'XXX', 'C');
    const withNegative = new Map([...values, [benchWarmer.playerId, -1]]);
    const pruned = findTrades({ mine: myCentres, theirs: theirDs, slots, values, schedules: [thisWeek], today: MON, limit: 50 });
    const unpruned = findTrades({ mine: [...myCentres, benchWarmer], theirs: theirDs, slots, values: withNegative, schedules: [thisWeek], today: MON, limit: 50 });
    expect(summary(unpruned)).toEqual(summary(pruned));
  });

  it('finds nothing with an empty roster', () => {
    expect(findTrades({ mine: [], theirs: theirDs, slots, values, schedules: [thisWeek], today: MON })).toEqual([]);
  });
});
