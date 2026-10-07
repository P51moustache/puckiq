import type { FantasyPlayer } from '../../../types/fantasy';
import { roomTradeIdeas } from '../tradeIdeas';
import { busyNight, game, makeRoom, member, ME, player, slotsOf, snapshotOf, week } from './support/fixtures';

const MON = '2026-10-12';
/** EDM, VAN and CGY all play Monday, Wednesday and Friday. */
const schedule = week(
  MON,
  Object.fromEntries(['2026-10-12', '2026-10-14', '2026-10-16'].map((date) => [date, [game(date, 'EDM', 'VAN'), game(date, 'CGY', 'SEA'), ...busyNight(date)]])),
);

const myCentres = [3, 2.5, 2].map((_, index) => player(8470001 + index, `My C${index + 1}`, 'EDM', 'C'));
const benDs = [3, 2.5, 2].map((_, index) => player(8470101 + index, `Ben D${index + 1}`, 'VAN', 'D'));
const samDs = [3, 2.5, 2].map((_, index) => player(8470201 + index, `Sam D${index + 1}`, 'CGY', 'D'));

function valueMap(players: FantasyPlayer[][], grades: number[]): Map<number, number> {
  return new Map(players.flatMap((group) => group.map((p, index): [number, number] => [p.playerId, grades[index]])));
}

const snapshot = snapshotOf(
  [member(ME, 'Zach Attack', myCentres), member('u-ben', 'Ben’s Bombers', benDs), member('u-sam', 'Sam’s Snipers', samDs)],
  { room: makeRoom({ slots: slotsOf({ C: 1, D: 1 }) }) },
);

describe('roomTradeIdeas', () => {
  const input = { snapshot, mine: myCentres, values: valueMap([myCentres, benDs, samDs], [3, 2.5, 2]), schedules: [schedule], today: MON };

  it('offers the best deal with each league-mate before a second one with anybody', () => {
    const ideas = roomTradeIdeas(input);
    expect(ideas).toHaveLength(3);
    expect(ideas.slice(0, 2).map((idea) => idea.partnerName).sort()).toEqual(['Ben’s Bombers', 'Sam’s Snipers']);
    for (const idea of ideas) {
      expect(idea.myGain).toBeGreaterThan(0);
      expect(idea.theirGain).toBeGreaterThan(0);
      expect(myCentres).toContain(idea.give);
    }
  });

  it('never trades with myself and respects the limit', () => {
    const ideas = roomTradeIdeas({ ...input, limit: 10 });
    expect(ideas.some((idea) => idea.partnerId === ME)).toBe(false);
    expect(roomTradeIdeas({ ...input, limit: 1 })).toHaveLength(1);
  });

  it('has nothing when nobody else is in the room', () => {
    expect(roomTradeIdeas({ ...input, snapshot: snapshotOf([member(ME, 'Zach Attack', myCentres)]) })).toEqual([]);
  });
});
