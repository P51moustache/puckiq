export function adjustSliderValue(
  value: number,
  action: 'increment' | 'decrement',
  min: number,
  max: number,
  step: number,
): number {
  const next = action === 'increment' ? value + step : value - step;
  return Math.max(min, Math.min(max, Number(next.toFixed(10))));
}
