import { EMPTY_DUES } from '../../../types/league';
import { buildRoomBoard, buildRoomWeekRecap } from '../../../services/league';
import { DEFAULT_SCORING } from '../../../services/fantasy/scoring';
import { boardRowViews, nightSummary, rowDetail } from '../boardView';
import { checkDuesForm, duesToForm, formToDues, parseAmount } from '../duesForm';
import { countText, gainText, gapText, moneyText, ordinal, reportRoomMailto, rosterAgeText } from '../format';
import { deriveLeagueStatus, teamWithRoomOpponent, withDuesPaid, withOpponentPick, withoutMember, withReaction, withRoom } from '../leagueState';
import { reactionCounts } from '../reactions';
import { roomRecapShareContent } from '../shareContent';
import {
  BEN,
  busyNight,
  edmCol,
  game,
  makeRoom,
  makeTeam,
  makar,
  mcdavid,
  ME,
  member,
  NOW,
  player,
  reaction,
  roomSnapshot,
  SAM,
  thisWeek,
  TODAY,
  week,
} from './support/fixtures';

const HOUR_MS = 60 * 60 * 1000;

describe('format', () => {
  it('writes whole-unit money with the currency only when it is not USD', () => {
    expect(moneyText(50, 'USD')).toBe('$50');
    expect(moneyText(1200, 'CAD')).toBe('$1,200 CAD');
  });

  it('writes places as ordinals, teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st',
    ]);
  });

  it('says how old a roster is in hours, then days', () => {
    expect(rosterAgeText(0.2)).toBe('updated just now');
    expect(rosterAgeText(30)).toBe('updated 30 h ago');
    expect(rosterAgeText(73)).toBe('updated 3 d ago');
    expect(rosterAgeText(Number.POSITIVE_INFINITY)).toBe('roster not synced');
  });

  it('shows gaps to the leader like a timing tower', () => {
    expect(gapText(12.5, 12.5)).toBe('LEAD');
    expect(gapText(9.3, 12.5)).toBe('−3.2');
    expect(gapText(null, 12.5)).toBe('—');
    expect(gainText(2.44)).toBe('+2.4');
    expect(countText(1, 'start')).toBe('1 start');
    expect(countText(3, 'start')).toBe('3 starts');
  });

  it('fills the report email with what support needs to find the room', () => {
    const mailto = reportRoomMailto({ id: 'room-1', name: 'Beer League', code: 'ABC234' });
    expect(mailto.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(mailto)).toContain('Room ID: room-1');
    expect(decodeURIComponent(mailto)).toContain('Code: ABC234');
  });
});

describe('reactionCounts', () => {
  it('counts what a member received in the last day, in preset order', () => {
    const reactions = [
      reaction(1, ME, '🚨'),
      reaction(2, ME, '🔥'),
      reaction(3, ME, '🔥', 5),
      reaction(4, ME, '😂', 30), // older than the window
      reaction(5, BEN, '🧂'), // someone else's
    ];
    expect(reactionCounts(reactions, ME, NOW)).toEqual([
      { emoji: '🔥', count: 2 },
      { emoji: '🚨', count: 1 },
    ]);
  });
});

describe('deriveLeagueStatus', () => {
  const base = { available: true, ready: true, userId: ME, roomId: 'room-1', snapshot: null, failed: false };

  it('walks unavailable → loading → signed out → no room → ready / error', () => {
    expect(deriveLeagueStatus({ ...base, available: false })).toBe('unavailable');
    expect(deriveLeagueStatus({ ...base, ready: false })).toBe('loading');
    expect(deriveLeagueStatus({ ...base, userId: null })).toBe('signed_out');
    expect(deriveLeagueStatus({ ...base, roomId: null })).toBe('no_room');
    expect(deriveLeagueStatus(base)).toBe('loading');
    expect(deriveLeagueStatus({ ...base, failed: true })).toBe('error');
    expect(deriveLeagueStatus({ ...base, snapshot: roomSnapshot(), failed: true })).toBe('ready');
  });
});

describe('teamWithRoomOpponent', () => {
  it('fills the matchup from the room and leaves the team alone when nothing changed', () => {
    const snapshot = withOpponentPick(roomSnapshot(), BEN);
    const team = teamWithRoomOpponent(makeTeam({ roomId: 'room-1' }), snapshot);
    expect(team.opponentName).toBe('Ben’s Bombers');
    expect(team.opponentSource).toBe('room');
    expect(team.opponent.map((p) => p.playerId)).toHaveLength(3);
    expect(teamWithRoomOpponent(team, snapshot)).toBe(team);
  });

  it('clears a room opponent the room dropped but never a typed-in one', () => {
    const snapshot = roomSnapshot();
    const fromRoom = makeTeam({ roomId: 'room-1', opponentName: 'Ben’s Bombers', opponent: [makar], opponentSource: 'room' });
    const cleared = teamWithRoomOpponent(fromRoom, snapshot);
    expect(cleared.opponent).toEqual([]);
    expect(cleared.opponentName).toBe('');
    const typed = makeTeam({ roomId: 'room-1', opponentName: 'Rival', opponent: [makar], opponentSource: 'manual' });
    expect(teamWithRoomOpponent(typed, snapshot)).toBe(typed);
  });
});

describe('optimistic snapshot edits', () => {
  it('sets my pick, marks dues, adds a pending reaction and swaps the room row', () => {
    const snapshot = roomSnapshot();
    expect(withOpponentPick(snapshot, BEN).members.find((m) => m.userId === ME)?.opponentUserId).toBe(BEN);
    const paid = withDuesPaid(snapshot, BEN, true, NOW);
    expect(paid.dues).toEqual([{ roomId: 'room-1', userId: BEN, paid: true, updatedAt: NOW.toISOString() }]);
    expect(withDuesPaid(paid, BEN, false, NOW).dues[0].paid).toBe(false);
    const reacted = withReaction(withReaction(snapshot, BEN, '🔥', NOW), BEN, '🚨', NOW);
    expect(reacted.reactions.map((row) => [row.id, row.emoji, row.fromUserId])).toEqual([[-2, '🚨', ME], [-1, '🔥', ME]]);
    const renamed = withRoom(snapshot, { ...snapshot.room, name: 'Pond Hockey' });
    expect(renamed.room.name).toBe('Pond Hockey');
    expect(withRoom(snapshot, { ...snapshot.room, id: 'other' })).toBe(snapshot);
  });

  it('removes a member with their dues, reactions and anyone’s pick of them', () => {
    const snapshot = withOpponentPick({ ...roomSnapshot(), reactions: [reaction(1, BEN, '🔥', 1, ME)] }, BEN);
    const after = withoutMember(withDuesPaid(snapshot, BEN, true, NOW), BEN);
    expect(after.members.map((m) => m.userId)).toEqual([ME, SAM]);
    expect(after.members[0].opponentUserId).toBeNull();
    expect(after.dues).toEqual([]);
    expect(after.reactions).toEqual([]);
  });
});

describe('boardRowViews', () => {
  it('numbers rows, flags missing and stale rosters and attaches reaction counts', () => {
    const base = roomSnapshot();
    const snapshot = {
      ...base,
      members: base.members.map((m) => (m.userId === BEN ? { ...m, rosterUpdatedAt: new Date(NOW.getTime() - 73 * HOUR_MS).toISOString() } : m)),
      reactions: [reaction(1, ME, '🔥')],
    };
    const rows = buildRoomBoard({ snapshot, schedule: thisWeek, today: TODAY, scoring: DEFAULT_SCORING });
    const views = boardRowViews(rows, snapshot, NOW);
    expect(views.map((v) => [v.position, v.userId])).toEqual(rows.map((row, index) => [index + 1, row.userId]));
    const ben = views.find((v) => v.userId === BEN)!;
    expect(ben.staleNote).toBe('updated 3 d ago');
    expect(rowDetail(ben, false)).toBe('updated 3 d ago');
    const sam = views.find((v) => v.userId === SAM)!;
    expect(sam.noRoster).toBe(true);
    expect(rowDetail(sam, true)).toBe('no roster yet');
    expect(views.find((v) => v.isMe)?.reactions).toEqual([{ emoji: '🔥', count: 1 }]);
    expect(views.every((v) => v.gap === '—')).toBe(true);
  });

  it('shows gaps to the leader and no-slot counts once points are in', () => {
    const rows = [
      { userId: ME, teamName: 'Zach Attack', isMe: true, playingToday: 4, startersToday: 3, gamesThatCountLeft: 5, livePoints: 12.5 },
      { userId: BEN, teamName: 'Ben’s Bombers', isMe: false, playingToday: 3, startersToday: 3, gamesThatCountLeft: 4, livePoints: 9.3 },
    ];
    const views = boardRowViews(rows, roomSnapshot(), NOW);
    expect(views.map((v) => v.gap)).toEqual(['LEAD', '−3.2']);
    expect(rowDetail(views[0], true)).toBe('4 playing · 1 no slot');
    expect(rowDetail(views[1], false)).toBe('');
  });
});

describe('nightSummary', () => {
  it('counts live, final and upcoming games and finds the first puck drop', () => {
    const late = game(TODAY, 'SEA', 'LAK', { startTimeUTC: `${TODAY}T02:00:00Z` });
    const summary = nightSummary([
      { ...edmCol, state: 'LIVE' },
      game(TODAY, 'BOS', 'NYR', { state: 'OFF' }),
      game(TODAY, 'VAN', 'CGY', { startTimeUTC: `${TODAY}T23:30:00Z` }),
      late,
    ]);
    expect(summary).toEqual({ games: 4, live: 1, final: 1, upcoming: 2, firstPuck: `${TODAY}T02:00:00Z` });
  });
});

describe('dues form', () => {
  it('round-trips dues and reads forgiving amounts', () => {
    const dues = { amount: 50, currency: 'CAD' as const, deadline: '2026-10-31', payouts: [{ place: 2, amount: 100 }, { place: 1, amount: 300 }], potLink: 'https://leaguesafe.com/x' };
    const form = duesToForm(dues);
    expect(form).toEqual({ amount: '50', currency: 'CAD', deadline: '2026-10-31', payouts: ['300', '100'], potLink: 'https://leaguesafe.com/x' });
    expect(formToDues(form)).toEqual({ ...dues, payouts: [{ place: 1, amount: 300 }, { place: 2, amount: 100 }] });
    expect(parseAmount('$1,200')).toBe(1200);
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('ten')).toBeNaN();
    expect(duesToForm(EMPTY_DUES)).toEqual({ amount: '', currency: 'USD', deadline: '', payouts: [], potLink: '' });
  });

  it('drops unfinished payout rows at the end but flags a blank in the middle', () => {
    const form = { ...duesToForm(EMPTY_DUES), amount: '50', payouts: ['300', '', '100', ''] };
    expect(formToDues(form).payouts).toEqual([{ place: 1, amount: 300 }, { place: 2, amount: Number.NaN }, { place: 3, amount: 100 }]);
    expect(checkDuesForm(form, 10)).toEqual({ ok: false, message: 'Each payout is a whole amount above zero.' });
    expect(checkDuesForm({ ...form, payouts: ['300', '100', ''] }, 10)).toEqual({
      ok: true,
      dues: { amount: 50, currency: 'USD', deadline: null, payouts: [{ place: 1, amount: 300 }, { place: 2, amount: 100 }], potLink: null },
    });
  });

  it('uses the services’ copy for problems, including payouts bigger than the pot', () => {
    const form = { ...duesToForm(EMPTY_DUES), amount: '10', payouts: ['500'] };
    expect(checkDuesForm(form, 10)).toEqual({ ok: false, message: 'The payouts add up to more than the pot.' });
    expect(checkDuesForm({ ...form, amount: '12.5', payouts: [] }, 10)).toEqual({ ok: false, message: 'Dues are a whole amount from 0 to 10,000.' });
    expect(checkDuesForm({ ...form, payouts: [], potLink: 'http://pot.example' }, 10)).toEqual({ ok: false, message: 'Pot links must start with https://.' });
  });
});

describe('roomRecapShareContent', () => {
  const lastMonday = '2026-10-05';
  const schedule = week(lastMonday, {
    '2026-10-05': [game('2026-10-05', 'EDM', 'COL'), ...busyNight('2026-10-05')],
    '2026-10-07': [game('2026-10-07', 'EDM', 'CGY'), ...busyNight('2026-10-07')],
  });

  it('shares the room’s week: the winning count, the headline and the leader’s busiest players', () => {
    const snapshot = roomSnapshot();
    const recap = buildRoomWeekRecap({ snapshot, schedule, slots: snapshot.room.slots });
    const content = roomRecapShareContent(recap, snapshot, schedule)!;
    expect(content.kind).toBe('room');
    expect(content.kicker).toBe('WEEK OF OCT 5');
    expect(content.teamName).toBe('Beer League');
    expect(content.count).toBe(recap.awards.mostGamesThatCount!.value);
    expect(content.caption).toBe(recap.headline);
    expect(content.players.map((p) => [p.name, p.detail])).toEqual([
      ['Connor McDavid', '2 starts'],
      ['Cale Makar', '1 start'],
    ]);
  });

  it('has nothing to share when no game counted', () => {
    const snapshot = roomSnapshot();
    const empty = week(lastMonday, {});
    expect(roomRecapShareContent(buildRoomWeekRecap({ snapshot, schedule: empty, slots: snapshot.room.slots }), snapshot, empty)).toBeNull();
  });
});

describe('fixtures sanity', () => {
  it('builds a room where the owner is me', () => {
    expect(makeRoom().ownerId).toBe(ME);
    expect(member(ME, 'x').userId).toBe(ME);
    expect(player(1, 'A B', 'EDM', 'C').playerId).toBe(1);
    expect(mcdavid.teamAbbrev).toBe('EDM');
  });
});
