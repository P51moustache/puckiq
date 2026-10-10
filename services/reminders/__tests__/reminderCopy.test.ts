import type { SlotKey } from '../../../types/fantasy';
import { lineupReminderCopy, playingText, type TeamNight } from '../reminderCopy';

function openOnly(emptySlots: SlotKey[], name = 'Beauties'): TeamNight {
  return { name, playing: 4, change: { start: [], bench: [], emptySlots } };
}

describe('reminder copy', () => {
  it('words open slots by position, in lineup order', () => {
    expect(lineupReminderCopy([openOnly(['D', 'D'])], '7:00 PM')).toEqual({
      title: '2 open D slots tonight',
      body: '4 of your players play tonight · 2 D slots open. First puck 7:00 PM.',
    });
    expect(lineupReminderCopy([openOnly(['G', 'D'])], '7:00 PM')).toEqual({
      title: '2 open slots tonight',
      body: '4 of your players play tonight · D and G slots open. First puck 7:00 PM.',
    });
  });

  it('doesn’t list the open slots of a light night, where they would bury the moves', () => {
    const light: TeamNight = { name: 'Beauties', playing: 2, change: { start: [{ playerId: 8_400_000, name: 'Hyman', slot: 'LW' }], bench: [], emptySlots: ['C', 'D', 'D', 'G'] } };
    expect(lineupReminderCopy([light], '7:00 PM')).toEqual({ title: 'Lineup change tonight', body: 'Start Hyman. First puck 7:00 PM.' });
    expect(lineupReminderCopy([openOnly(['C', 'D', 'G'])], '7:00 PM')).toEqual({ title: 'Set your lineup', body: '4 of your players play tonight. First puck 7:00 PM.' });
  });

  it('keeps the player-count wording when nothing needs moving or filling', () => {
    const teams: TeamNight[] = [
      { name: 'Beauties', playing: 4, change: { start: [], bench: [], emptySlots: [] } },
      { name: 'Bench Mob', playing: 2, change: null },
    ];
    expect(playingText(teams)).toBe('Beauties: 4 · Bench Mob: 2');
    expect(lineupReminderCopy(teams, '7:00 PM')).toEqual({ title: 'Set your lineup', body: 'Beauties: 4 · Bench Mob: 2. First puck 7:00 PM.' });
  });

  it('keeps "Set your lineup" when a team without data shares the night with open slots', () => {
    const copy = lineupReminderCopy([openOnly(['G']), { name: 'Bench Mob', playing: 2, change: null }], '7:00 PM');
    expect(copy).toEqual({ title: 'Set your lineup', body: 'Beauties: 4 play tonight · G slot open. Bench Mob: 2 play tonight. First puck 7:00 PM.' });
  });
});
