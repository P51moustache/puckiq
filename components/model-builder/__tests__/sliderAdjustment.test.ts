import { adjustSliderValue } from '../sliderAdjustment';

it('increments and decrements native adjustable values by one step and clamps the range', () => {
  expect(adjustSliderValue(1, 'increment', 0, 2, 0.1)).toBe(1.1);
  expect(adjustSliderValue(1, 'decrement', 0, 2, 0.1)).toBe(0.9);
  expect(adjustSliderValue(2, 'increment', 0, 2, 0.1)).toBe(2);
  expect(adjustSliderValue(0, 'decrement', 0, 2, 0.1)).toBe(0);
});
