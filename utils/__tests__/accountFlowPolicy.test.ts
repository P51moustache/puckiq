import { getSettingsOriginFromPathname, getSettingsReturnRoute, getSupportDestination, proBenefits } from '../accountFlowPolicy';

describe('account flow policy', () => {
  it('uses only supported Settings origins with a Tonight fallback', () => {
    expect(getSettingsReturnRoute('following')).toBe('/(tabs)/following');
    expect(getSettingsReturnRoute('players')).toBe('/(tabs)/players');
    expect(getSettingsReturnRoute('unknown')).toBe('/(tabs)');
    expect(getSettingsReturnRoute(undefined)).toBe('/(tabs)');
  });

  it('maps each production tab pathname to a restorable Settings origin', () => {
    expect(getSettingsOriginFromPathname('/following')).toBe('following');
    expect(getSettingsOriginFromPathname('/players')).toBe('players');
    expect(getSettingsOriginFromPathname('/stats')).toBe('league');
    expect(getSettingsOriginFromPathname('/')).toBe('tonight');
    expect(getSettingsOriginFromPathname('/unexpected')).toBe('tonight');
  });

  it('does not invent a support destination when none is configured', () => {
    expect(getSupportDestination(undefined)).toBeNull();
    expect(getSupportDestination('support@example.com')).toEqual({ type: 'email', value: 'support@example.com' });
    expect(getSupportDestination('https://help.example.com/puckiq')).toEqual({ type: 'url', value: 'https://help.example.com/puckiq' });
    expect(getSupportDestination('not a destination')).toBeNull();
  });

  it('describes only benefits that are actually gated', () => {
    expect(proBenefits.map((benefit) => benefit.title)).toEqual([
      'Fantasy Projections',
      'My Team',
    ]);
  });
});
