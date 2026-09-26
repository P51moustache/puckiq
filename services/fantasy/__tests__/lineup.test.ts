import { assignLineup, expandSlots, presetFor, sanitizeSlots, slotsLabel, STANDARD_SLOTS } from '../lineup';
import { eligibleSlots, isNhlLinked, normalizePosition, positionLabel } from '../positions';
import type { LineupSlots } from '../../../types/fantasy';

const slots = (partial: Partial<LineupSlots>): LineupSlots => ({ C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0, ...partial });

describe('positions', () => {
  it('maps NHL codes to fantasy eligibility', () => {
    expect(normalizePosition('L')).toBe('LW');
    expect(normalizePosition('R')).toBe('RW');
    expect(eligibleSlots({ position: 'C' })).toEqual(['C', 'F', 'UTIL']);
    expect(eligibleSlots({ position: 'D' })).toEqual(['D', 'UTIL']);
    expect(eligibleSlots({ position: 'G' })).toEqual(['G']);
  });

  it('honours league multi-eligibility overrides', () => {
    expect(eligibleSlots({ position: 'C', eligible: ['C', 'LW'] })).toEqual(['C', 'LW', 'F', 'UTIL']);
    expect(positionLabel({ position: 'C', eligible: ['C', 'LW'] })).toBe('C/LW');
  });

  it('treats 2.x typed names (timestamp ids) as unlinked', () => {
    expect(isNhlLinked({ playerId: 8478402 })).toBe(true);
    expect(isNhlLinked({ playerId: 1_756_000_000_000_123 })).toBe(false);
  });
});

describe('assignLineup', () => {
  it('seats by value and benches overflow at a crowded position', () => {
    const result = assignLineup(
      [
        { playerId: 1, slots: ['C', 'F', 'UTIL'], value: 3 },
        { playerId: 2, slots: ['C', 'F', 'UTIL'], value: 2 },
        { playerId: 3, slots: ['C', 'F', 'UTIL'], value: 1 },
      ],
      slots({ C: 2 }),
    );
    expect(result.starters.map((seat) => seat.playerId).sort()).toEqual([1, 2]);
    expect(result.bench).toEqual([3]);
    expect(result.empty).toEqual([]);
  });

  it('moves a flexible player to UTIL so a lower-value specialist still starts', () => {
    // D-man (value 2) can play D or UTIL. Centre (value 1) only C/UTIL. One C taken by a better centre.
    const result = assignLineup(
      [
        { playerId: 10, slots: ['C', 'F', 'UTIL'], value: 5 },
        { playerId: 11, slots: ['D', 'UTIL'], value: 2 },
        { playerId: 12, slots: ['C', 'F', 'UTIL'], value: 1 },
      ],
      slots({ C: 1, D: 1, UTIL: 1 }),
    );
    expect(result.bench).toEqual([]);
    expect(result.empty).toEqual([]);
    const seats = Object.fromEntries(result.starters.map((seat) => [seat.playerId, seat.slot]));
    expect(seats[10]).toBe('C');
    expect(seats[11]).toBe('D');
    expect(seats[12]).toBe('UTIL');
  });

  it('keeps the highest-value set when not everyone fits', () => {
    const result = assignLineup(
      [
        { playerId: 1, slots: ['D', 'UTIL'], value: 1 },
        { playerId: 2, slots: ['D', 'UTIL'], value: 4 },
        { playerId: 3, slots: ['D', 'UTIL'], value: 3 },
      ],
      slots({ D: 1, UTIL: 1 }),
    );
    expect(result.bench).toEqual([1]);
  });

  it('reports empty slots nobody could fill', () => {
    const result = assignLineup([{ playerId: 1, slots: ['G'], value: 6 }], slots({ G: 2, D: 1 }));
    expect(result.empty.sort()).toEqual(['D', 'G']);
  });
});

describe('slot helpers', () => {
  it('expands slot counts in lineup order', () => {
    expect(expandSlots(slots({ C: 1, D: 2, G: 1 }))).toEqual(['C', 'D', 'D', 'G']);
  });

  it('clamps bad input and recognises presets', () => {
    expect(sanitizeSlots({ C: -2, D: 99 } as Partial<LineupSlots>)).toMatchObject({ C: 0, D: 8 });
    expect(presetFor(STANDARD_SLOTS)?.id).toBe('standard');
    expect(slotsLabel(STANDARD_SLOTS)).toBe('2 C · 2 LW · 2 RW · 4 D · 1 UTIL · 2 G');
  });
});
