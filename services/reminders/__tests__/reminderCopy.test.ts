import type { SlotKey } from '../../../types/fantasy';
import { lineupReminderCopy, liveReminderCopy, type TeamNight } from '../reminderCopy';

function openOnly(emptySlots: SlotKey[], name = 'Beauties'): TeamNight {
  return { name, playing: 4, change: { start: [], bench: [], emptySlots } };
}

const row = (name: string) => ({ playerId: 8_400_000, name, slot: 'LW' as SlotKey });

describe('reminder copy', () => {
  it('lists one team’s moves one per line, title first with the puck drop', () => {
    const team: TeamNight = { name: 'Beauties', playing: 7, change: { start: [row('Hyman'), row('Pesce')], bench: [row('Kreider')], emptySlots: ['G'] } };
    expect(lineupReminderCopy([team], '7:00 PM')).toEqual({
      title: 'Set your lineup by 7:00 PM',
      body: 'Start: Hyman, Pesce\nSit: Kreider\nOpen: G slot',
    });
  });

  it('caps a long name list with "+N more"', () => {
    const team: TeamNight = { name: 'Beauties', playing: 9, change: { start: ['A', 'B', 'C', 'D', 'E'].map(row), bench: [], emptySlots: [] } };
    expect(lineupReminderCopy([team], '7:00 PM').body).toBe('Start: A, B, C +2 more');
  });

  it('words open slots by position, in lineup order', () => {
    expect(lineupReminderCopy([openOnly(['D', 'D'])], '7:00 PM')).toEqual({
      title: 'Set your lineup by 7:00 PM',
      body: 'Playing: 4 of your players\nOpen: 2 D slots',
    });
    expect(lineupReminderCopy([openOnly(['G', 'D'])], '7:00 PM').body).toBe('Playing: 4 of your players\nOpen: D and G slots');
  });

  it('doesn’t list the open slots of a light night, where they would bury the moves', () => {
    const light: TeamNight = { name: 'Beauties', playing: 2, change: { start: [row('Hyman')], bench: [], emptySlots: ['C', 'D', 'D', 'G'] } };
    expect(lineupReminderCopy([light], '7:00 PM').body).toBe('Start: Hyman');
    expect(lineupReminderCopy([openOnly(['C', 'D', 'G'])], '7:00 PM').body).toBe('Playing: 4 of your players');
  });

  it('leads each line with the team when there are several, and drops teams with nothing to do', () => {
    const teams: TeamNight[] = [
      { name: 'Beauties', playing: 7, change: { start: [row('Hyman'), row('Pesce'), row('Nylander')], bench: [row('Kreider')], emptySlots: [] } },
      openOnly(['G'], 'Bench Mob'),
      { name: 'Quiet', playing: 3, change: { start: [], bench: [], emptySlots: [] } },
    ];
    expect(lineupReminderCopy(teams, '7:00 PM')).toEqual({
      title: 'Set your lineups by 7:00 PM',
      body: 'Beauties: Start Hyman, Pesce +1 more\nBeauties: Sit Kreider\nBench Mob: Fill G slot',
    });
  });

  it('shows every team’s player count when nothing needs moving or filling', () => {
    const teams: TeamNight[] = [
      { name: 'Beauties', playing: 4, change: { start: [], bench: [], emptySlots: [] } },
      { name: 'Bench Mob', playing: 2, change: null },
    ];
    expect(lineupReminderCopy(teams, '7:00 PM')).toEqual({ title: 'Set your lineups by 7:00 PM', body: 'Beauties: 4 playing\nBench Mob: 2 playing' });
  });

  it('keeps a team without lineup data next to one with open slots', () => {
    const copy = lineupReminderCopy([openOnly(['G']), { name: 'Bench Mob', playing: 2, change: null }], '7:00 PM');
    expect(copy).toEqual({ title: 'Set your lineups by 7:00 PM', body: 'Beauties: Fill G slot\nBench Mob: 2 playing' });
  });

  it('says how many play when the night goes live', () => {
    expect(liveReminderCopy([{ name: 'Beauties', playing: 7, change: null }])).toEqual({ title: 'Your night is live', body: '7 of your players are playing' });
    expect(liveReminderCopy([{ name: 'Beauties', playing: 1, change: null }]).body).toBe('1 of your players is playing');
    expect(liveReminderCopy([{ name: 'Beauties', playing: 7, change: null }, { name: 'Bench Mob', playing: 4, change: null }]).body)
      .toBe('Beauties: 7 playing\nBench Mob: 4 playing');
  });
});
