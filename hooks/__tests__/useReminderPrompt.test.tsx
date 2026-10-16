jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const mockEnable = jest.fn(() => Promise.resolve(true));
jest.mock('../../components/RemindersProvider', () => ({
  useReminders: () => ({ settings: { enabled: false, minutesBefore: 30, liveStart: false }, permission: 'undetermined', enable: mockEnable }),
}));
jest.mock('../../services/analytics/track', () => ({ track: jest.fn() }));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import { REMINDER_SHEET_DELAY_MS, useReminderPrompt, type ReminderPrompt } from '../useReminderPrompt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReminderPrompt | null = null;
function Probe(props: { gameDay: boolean; callShown: boolean }) {
  latest = useReminderPrompt(props);
  return null;
}

async function mount(props: { gameDay: boolean; callShown: boolean }) {
  let tree: any;
  await act(async () => {
    tree = create(<Probe {...props} />);
  });
  return tree;
}

describe('useReminderPrompt', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits for the lineup call to have been on screen a moment before asking', async () => {
    const tree = await mount({ gameDay: true, callShown: true });
    expect(latest!.visible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(REMINDER_SHEET_DELAY_MS - 1);
    });
    expect(latest!.visible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(latest!.visible).toBe(true);
    expect(latest!.minutesBefore).toBe(30);
    act(() => tree.unmount());
  });

  it('never asks before the call has loaded', async () => {
    const tree = await mount({ gameDay: true, callShown: false });
    act(() => {
      jest.advanceTimersByTime(REMINDER_SHEET_DELAY_MS * 2);
    });
    expect(latest!.visible).toBe(false);
    act(() => tree.unmount());
  });
});
