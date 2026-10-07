import { buildRoomWeekRecap } from '../recap';
import { busyNight, game, member, ME, player, slotsOf, snapshotOf, week } from './fixtures';

const LAST_MON = '2026-10-05';
const [MON, TUE, WED, THU] = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
const slots = slotsOf({ C: 1, D: 1, G: 1 });

const schedule = week(LAST_MON, {
  [MON]: [game(MON, 'EDM', 'VAN'), ...busyNight(MON)],
  [TUE]: [game(TUE, 'TOR', 'MTL'), ...busyNight(TUE)],
  [WED]: [game(WED, 'EDM', 'CGY'), ...busyNight(WED)],
  [THU]: [game(THU, 'VAN', 'TOR'), ...busyNight(THU)],
});

// Me: two EDM centres for one C slot (overflow both EDM nights), no goalie.
const zach = member(ME, 'Zach Attack', [
  player(8470001, 'Centre A', 'EDM', 'C'),
  player(8470002, 'Centre B', 'EDM', 'C'),
  player(8470003, 'Dman', 'EDM', 'D'),
]);
const ben = member('u-ben', 'Ben’s Bombers', [
  player(8470101, 'Ben Centre', 'VAN', 'C'),
  player(8470102, 'Ben Dman', 'VAN', 'D'),
  player(8470103, 'Ben Goalie', 'VAN', 'G'),
]);
const sam = member('u-sam', 'Sam’s Snipers', [player(8470201, 'Sam Centre', 'TOR', 'C'), player(8470202, 'Sam Dman', 'TOR', 'D')]);
const ghost = member('u-ghost', 'Ghost Team', []);

describe('buildRoomWeekRecap', () => {
  const recap = buildRoomWeekRecap({ snapshot: snapshotOf([zach, ben, sam, ghost]), schedule, slots });

  it('counts games that counted, games lost to the bench and empty slot-days per member', () => {
    expect(recap.monday).toBe(LAST_MON);
    expect(recap.members.map((row) => [row.teamName, row.gamesThatCounted, row.gamesLostToBench, row.emptySlotDays])).toEqual([
      ['Ben’s Bombers', 6, 0, 6],
      ['Sam’s Snipers', 4, 0, 8],
      ['Zach Attack', 4, 2, 8],
      ['Ghost Team', 0, 0, 12],
    ]);
    expect(recap.members.find((row) => row.isMe)?.userId).toBe(ME);
  });

  it('hands out awards, sharing ties and skipping members with no roster', () => {
    expect(recap.awards.mostGamesThatCount).toEqual({ winners: [{ userId: 'u-ben', teamName: 'Ben’s Bombers' }], value: 6 });
    expect(recap.awards.benchOfShame).toEqual({ winners: [{ userId: ME, teamName: 'Zach Attack' }], value: 2 });
    expect(recap.awards.emptiestLineup).toEqual({
      winners: [
        { userId: 'u-sam', teamName: 'Sam’s Snipers' },
        { userId: ME, teamName: 'Zach Attack' },
      ],
      value: 8,
    });
  });

  it('leads with the leader', () => {
    expect(recap.headline).toBe('Ben’s Bombers led the room with 6 games that counted.');
  });

  it('words ties and single games naturally', () => {
    const edmCentre = (id: number) => [player(id, `Centre ${id}`, 'EDM', 'C')];
    const two = buildRoomWeekRecap({
      snapshot: snapshotOf([member(ME, 'Zach Attack', edmCentre(8470001)), member('u-ben', 'Ben’s Bombers', edmCentre(8470002))]),
      schedule,
      slots,
    });
    expect(two.headline).toBe('Ben’s Bombers and Zach Attack tied for the lead with 2 games that counted.');

    const three = buildRoomWeekRecap({
      snapshot: snapshotOf([
        member(ME, 'Zach Attack', edmCentre(8470001)),
        member('u-ben', 'Ben’s Bombers', edmCentre(8470002)),
        member('u-sam', 'Sam’s Snipers', edmCentre(8470003)),
      ]),
      schedule,
      slots,
    });
    expect(three.headline).toBe('3 teams tied for the lead with 2 games that counted.');

    const one = buildRoomWeekRecap({ snapshot: snapshotOf([member(ME, 'Zach Attack', [player(8470301, 'Leaf', 'MTL', 'C')])]), schedule, slots });
    expect(one.headline).toBe('Zach Attack led the room with 1 game that counted.');
  });

  it('has no awards in a week without games', () => {
    const quiet = buildRoomWeekRecap({ snapshot: snapshotOf([zach, ben]), schedule: week(LAST_MON, {}), slots });
    expect(quiet.awards).toEqual({ mostGamesThatCount: null, benchOfShame: null, emptiestLineup: null });
    expect(quiet.headline).toBe('No games counted this week.');
  });
});
