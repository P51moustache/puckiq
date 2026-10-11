/** Shared zero baseline: signed bars and their axis always describe the same values. */
export function barScale(values: readonly (number | null)[], height: number) {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const min = Math.min(0, ...finite);
  const max = Math.max(1, ...finite);
  const y = (value: number) => ((max - value) / (max - min)) * height;
  return {
    min,
    max,
    zeroY: y(0),
    ticks: min < 0 ? [max, 0, min] : [max, max / 2, 0],
    y,
    bar: (value: number | null) => ({
      top: y(Math.max(0, value ?? 0)),
      height: (Math.abs(value ?? 0) / (max - min)) * height,
    }),
  };
}
