import { STALE_ROSTER_HOURS } from '../availability';
import { rosterForUpload } from '../roster';
import { ROSTER_PUSH_DEBOUNCE_MS, ROSTER_REFRESH_HOURS, rosterNeedsPush } from '../sync';
import { makeTeam, member, ME, NOW, player } from './fixtures';

const roster = [player(8470001, 'Connor Star', 'EDM', 'C'), player(8470002, 'On IR', 'TOR', 'D', { injuredReserve: true })];
const team = makeTeam({ name: 'Zach Attack', players: roster });
const inRoom = member(ME, 'Zach Attack', rosterForUpload(roster));
const later = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000);

describe('rosterNeedsPush', () => {
  it('has nothing to compare against without my member row', () => {
    expect(rosterNeedsPush(team, undefined)).toBe(false);
  });

  it('skips the write when the room already matches, in any order', () => {
    expect(rosterNeedsPush(team, inRoom)).toBe(false);
    expect(rosterNeedsPush(makeTeam({ name: '  Zach   Attack ', players: [...roster].reverse() }), inRoom)).toBe(false);
  });

  it('pushes a new team name', () => {
    expect(rosterNeedsPush(makeTeam({ name: 'Zach Attack II', players: roster }), inRoom)).toBe(true);
  });

  it('pushes added and dropped players', () => {
    expect(rosterNeedsPush(makeTeam({ players: [...roster, player(8470003, 'New Guy', 'VAN', 'D')] }), inRoom)).toBe(true);
    expect(rosterNeedsPush(makeTeam({ players: roster.slice(0, 1) }), inRoom)).toBe(true);
  });

  it('pushes a trade, an IR move or an eligibility change', () => {
    const [star, hurt] = roster;
    expect(rosterNeedsPush(makeTeam({ players: [{ ...star, teamAbbrev: 'SEA' }, hurt] }), inRoom)).toBe(true);
    expect(rosterNeedsPush(makeTeam({ players: [star, { ...hurt, injuredReserve: false }] }), inRoom)).toBe(true);
    expect(rosterNeedsPush(makeTeam({ players: [{ ...star, eligible: ['C', 'LW'] }, hurt] }), inRoom)).toBe(true);
  });

  it('ignores players that never upload (unlinked 2.x names)', () => {
    expect(rosterNeedsPush(makeTeam({ players: [...roster, player(1_756_000_000_000_001, 'Typed Name', '', 'C')] }), inRoom)).toBe(false);
  });

  it('re-confirms an unchanged roster once it is a day old, when given the time', () => {
    expect(rosterNeedsPush(team, inRoom, later(ROSTER_REFRESH_HOURS + 1))).toBe(true);
    expect(rosterNeedsPush(team, inRoom, later(ROSTER_REFRESH_HOURS - 1))).toBe(false);
    expect(rosterNeedsPush(team, inRoom)).toBe(false);
  });
});

describe('sync timing', () => {
  it('re-confirms well before a roster reads as stale, and debounces edits', () => {
    expect(ROSTER_REFRESH_HOURS).toBeLessThan(STALE_ROSTER_HOURS);
    expect(ROSTER_PUSH_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});
