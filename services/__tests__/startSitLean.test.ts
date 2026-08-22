import { injurySignalFromText, leanStartSit } from '../startSitLean';

describe('leanStartSit', () => {
  it('sits a scratch', () => {
    expect(leanStartSit({ hasGameTonight: true, injurySignal: 'scratch', isGoalie: false }))
      .toEqual({ recommendation: 'SIT', reason: 'Scratched tonight' });
  });

  it('sits an out / IR player', () => {
    expect(leanStartSit({ hasGameTonight: true, injurySignal: 'out', isGoalie: false }).recommendation)
      .toBe('SIT');
  });

  it('sits when there is no game', () => {
    expect(leanStartSit({ hasGameTonight: false, injurySignal: 'ok', isGoalie: false }))
      .toEqual({ recommendation: 'SIT', reason: 'No game tonight' });
  });

  it('starts a healthy skater with a game', () => {
    expect(leanStartSit({ hasGameTonight: true, injurySignal: 'ok', isGoalie: false }))
      .toEqual({ recommendation: 'START', reason: 'Has a game tonight' });
  });

  it('flexes a day-to-day skater', () => {
    expect(leanStartSit({ hasGameTonight: true, injurySignal: 'dtd', isGoalie: false }).recommendation)
      .toBe('FLEX');
  });

  it('flexes a goalie until the starter is confirmed', () => {
    expect(leanStartSit({
      hasGameTonight: true,
      injurySignal: 'ok',
      isGoalie: true,
      goalieConfirmedStarter: null,
    }).recommendation).toBe('FLEX');
  });

  it('sits a goalie who is not starting', () => {
    expect(leanStartSit({
      hasGameTonight: true,
      injurySignal: 'ok',
      isGoalie: true,
      goalieConfirmedStarter: false,
    }).recommendation).toBe('SIT');
  });

  it('starts a confirmed goalie', () => {
    expect(leanStartSit({
      hasGameTonight: true,
      injurySignal: 'ok',
      isGoalie: true,
      goalieConfirmedStarter: true,
    }).recommendation).toBe('START');
  });
});

describe('injurySignalFromText', () => {
  it('detects IR / out language', () => {
    expect(injurySignalFromText('McDavid placed on IR')).toBe('out');
  });

  it('detects day-to-day language', () => {
    expect(injurySignalFromText('upper-body injury, day-to-day')).toBe('dtd');
  });

  it('detects scratch language', () => {
    expect(injurySignalFromText('healthy scratch tonight')).toBe('scratch');
  });

  it('returns null when there is no injury language', () => {
    expect(injurySignalFromText('McDavid scores twice')).toBeNull();
  });
});
