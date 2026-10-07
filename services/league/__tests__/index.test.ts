import * as league from '../index';

describe('services/league public API', () => {
  it('exposes what screens and hooks need from one import', () => {
    const expected = [
      'createRoom',
      'joinRoom',
      'leaveRoom',
      'fetchRoomSnapshot',
      'updateMembership',
      'updateRoom',
      'setDuesPaid',
      'removeMember',
      'rotateRoomCode',
      'react',
      'createLeagueApi',
      'codeFromLink',
      'inviteMessage',
      'cleanRoomText',
      'toLeagueError',
      'isLeagueUnavailable',
      'takenPlayerIds',
      'staleMembers',
      'roomOpponent',
      'opponentChoices',
      'buildRoomBoard',
      'boardGameIds',
      'buildRoomWeekRecap',
      'findTrades',
      'summarizeDues',
      'validateDues',
      'rosterNeedsPush',
    ];
    const exported = new Map<string, unknown>(Object.entries(league));
    for (const name of expected) expect(typeof exported.get(name)).toBe('function');
    expect(league.ROSTER_PUSH_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});
