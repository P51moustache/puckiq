import { barnLines, boardHero, lastName } from '../barn';

describe('boardHero', () => {
  it('writes the empty board line when nobody is listed', () => {
    expect(boardHero({ hasRoster: false })).toBe(barnLines.emptyBoard);
  });

  it('names an injured starter before anything else', () => {
    expect(boardHero({
      hasRoster: true,
      injuredName: 'Alex Forward',
      moveAction: 'START',
      moveName: 'Pat Goalie',
    })).toBe(barnLines.injuredStarter);
  });

  it('turns a move into a line', () => {
    expect(boardHero({
      hasRoster: true,
      moveAction: 'SIT',
      moveName: 'Cale Makar',
    })).toBe('SIT MAKAR');
  });

  it('falls back to the home line', () => {
    expect(lastName('Connor McDavid')).toBe('MCDAVID');
    expect(boardHero({ hasRoster: true, playing: 0 })).toBe(barnLines.home);
  });
});
