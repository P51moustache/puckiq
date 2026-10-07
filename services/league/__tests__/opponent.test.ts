import type { RoomMember } from '../../../types/league';
import { opponentChoices, roomOpponent } from '../opponent';
import { member, ME, player, snapshotOf } from './fixtures';

const zach = (patch: Partial<RoomMember> = {}) => member(ME, 'Zach Attack', [player(8470001, 'Mine', 'EDM', 'C')], patch);
const ben = (patch: Partial<RoomMember> = {}) => member('u-ben', 'Ben’s Bombers', [player(8470101, 'Ben Centre', 'VAN', 'C')], patch);
const sam = (patch: Partial<RoomMember> = {}) => member('u-sam', 'sam’s snipers', [player(8470201, 'Sam Goalie', 'TOR', 'G')], patch);
const al = (patch: Partial<RoomMember> = {}) => member('u-al', 'Al’s Allstars', [], patch);

describe('roomOpponent', () => {
  it('uses my pick, even when someone else picked me', () => {
    const opponent = roomOpponent(snapshotOf([zach({ opponentUserId: 'u-ben' }), ben(), sam({ opponentUserId: ME })]));
    expect(opponent).toEqual({ userId: 'u-ben', teamName: 'Ben’s Bombers', players: ben().roster, pickedBy: 'me' });
  });

  it('fills in from the one member who picked me when I haven’t picked', () => {
    expect(roomOpponent(snapshotOf([zach(), ben({ opponentUserId: ME }), sam()]))).toMatchObject({ userId: 'u-ben', pickedBy: 'them' });
  });

  it('stays empty when two members picked me', () => {
    expect(roomOpponent(snapshotOf([zach(), ben({ opponentUserId: ME }), sam({ opponentUserId: ME })]))).toBeNull();
  });

  it('ignores a pick of someone who has left the room', () => {
    expect(roomOpponent(snapshotOf([zach({ opponentUserId: 'u-gone' }), ben(), sam({ opponentUserId: ME })]))).toMatchObject({
      userId: 'u-sam',
      pickedBy: 'them',
    });
  });

  it('is null when I’m alone or not in the snapshot', () => {
    expect(roomOpponent(snapshotOf([zach()]))).toBeNull();
    expect(roomOpponent(snapshotOf([ben({ opponentUserId: ME })]))).toBeNull();
  });
});

describe('opponentChoices', () => {
  it('lists everyone but me by team name, ignoring case', () => {
    expect(opponentChoices(snapshotOf([zach(), sam(), ben(), al()])).map((row) => row.userId)).toEqual(['u-al', 'u-ben', 'u-sam']);
  });

  it('is empty when I’m alone', () => {
    expect(opponentChoices(snapshotOf([zach()]))).toEqual([]);
  });
});
