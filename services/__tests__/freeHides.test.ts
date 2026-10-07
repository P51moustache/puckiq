import { canHidePickup, FREE_WEEKLY_HIDES, hideAllowanceKey, parseHideCount } from '../fantasy/freeHides';

describe('free "Already taken" allowance', () => {
  it('allows two a week on Free and opens the paywall on the third', () => {
    expect(FREE_WEEKLY_HIDES).toBe(2);
    expect(canHidePickup(false, 0)).toBe(true);
    expect(canHidePickup(false, 1)).toBe(true);
    expect(canHidePickup(false, 2)).toBe(false);
    expect(canHidePickup(true, 99)).toBe(true);
  });

  it('counts per NHL week and reads storage defensively', () => {
    expect(hideAllowanceKey('2026-10-12')).toBe('puckiq_free_hides_2026-10-12');
    expect(parseHideCount(null)).toBe(0);
    expect(parseHideCount('3')).toBe(3);
    expect(parseHideCount('-1')).toBe(0);
    expect(parseHideCount('abc')).toBe(0);
  });
});
