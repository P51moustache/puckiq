import { barScale } from '../barScale';
it('places positive and negative bars on opposite sides of the labeled zero baseline', () => {
  const scale = barScale([-5, 0, 10, null], 150);
  expect(scale.zeroY).toBe(100);
  expect(scale.ticks).toEqual([10, 0, -5]);
  expect(scale.bar(10)).toEqual({ top: 0, height: 100 });
  expect(scale.bar(-5)).toEqual({ top: 100, height: 50 });
});
it('keeps missing and zero-only series finite', () => {
  const scale = barScale([0, null, NaN], 100);
  expect(scale.bar(null)).toEqual({ top: 100, height: 0 });
  expect(scale.max).toBe(1);
});
