import { track } from './track';

/** For fixed UI choices only. Never pass search text or user-written labels. */
export function trackedChoice<T extends string>(screen: string, control: string, apply: (value: T) => void): (value: T) => void {
  return value => {
    track('filter_select', { screen, control, value });
    apply(value);
  };
}
