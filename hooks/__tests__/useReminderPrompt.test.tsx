let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: () => { mockAppStateListener = null; } };
    },
  },
}));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
let mockReminders = { settings: { enabled: false, minutesBefore: 30, liveStart: false }, permission: 'undetermined' };
const mockEnable = jest.fn(() => Promise.resolve(true));
jest.mock('../../components/RemindersProvider', () => ({
  useReminders: () => ({ ...mockReminders, enable: mockEnable }),
}));
const mockTrack = jest.fn();
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReminderMoment } from '../../services/engagement/reminderPrompt';
import { REMINDER_PROMPT_KEY, REMINDER_SHEET_DELAY_MS, useReminderPrompt, type ReminderPrompt } from '../useReminderPrompt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Props { moment: ReminderMoment | null; callShown: boolean; otherPrompt?: boolean }

let latest: ReminderPrompt | null = null;
function Probe(props: Props) {
  latest = useReminderPrompt({ otherPrompt: false, ...props });
  return null;
}

async function mount(props: Props) {
  let tree: any;
  await act(async () => {
    tree = create(<Probe {...props} />);
  });
  return tree;
}

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const skips = () => mockTrack.mock.calls.filter((call) => call[0] === 'reminder_prompt_skipped').map((call) => call[1]);

describe('useReminderPrompt', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFocused = true;
    mockReminders = { settings: { enabled: false, minutesBefore: 30, liveStart: false }, permission: 'undetermined' };
    await AsyncStorage.removeItem(REMINDER_PROMPT_KEY);
  });
  afterEach(() => jest.useRealTimers());

  it('waits for the lineup call to have been on screen a moment before asking', async () => {
    const tree = await mount({ moment: 'before_lock', callShown: true });
    expect(latest!.visible).toBe(false);
    advance(REMINDER_SHEET_DELAY_MS - 1);
    expect(latest!.visible).toBe(false);
    advance(1);
    expect(latest!.visible).toBe(true);
    expect(latest!.moment).toBe('before_lock');
    expect(latest!.minutesBefore).toBe(30);
    expect(mockTrack).toHaveBeenCalledWith('reminder_prompt_view', { moment: 'before_lock' });
    act(() => tree.unmount());
    expect(skips()).toEqual([]);
  });

  it('asks after lock and from the recap too', async () => {
    for (const moment of ['after_lock', 'recap'] as const) {
      const tree = await mount({ moment, callShown: true });
      advance(REMINDER_SHEET_DELAY_MS);
      expect(latest!.visible).toBe(true);
      expect(latest!.moment).toBe(moment);
      act(() => tree.unmount());
    }
  });

  it('turns reminders on through the recap source from the recap, and Tonight otherwise', async () => {
    let tree = await mount({ moment: 'recap', callShown: true });
    await act(async () => { await latest!.accept(); });
    expect(mockEnable).toHaveBeenLastCalledWith({ source: 'recap_prompt', liveStart: true });
    expect(mockTrack).toHaveBeenCalledWith('reminder_prompt_answer', { answer: 'on', moment: 'recap' });
    act(() => tree.unmount());
    tree = await mount({ moment: 'after_lock', callShown: true });
    await act(async () => { await latest!.accept(); });
    expect(mockEnable).toHaveBeenLastCalledWith({ source: 'tonight_prompt', liveStart: true });
    act(() => tree.unmount());
  });

  it('never asks before the call has loaded, and logs that when the visit ends', async () => {
    const tree = await mount({ moment: 'before_lock', callShown: false });
    advance(REMINDER_SHEET_DELAY_MS * 2);
    expect(latest!.visible).toBe(false);
    expect(latest!.moment).toBeNull();
    act(() => tree.unmount());
    expect(skips()).toEqual([{ reason: 'call_loading', moment: 'before_lock' }]);
  });

  it('only counts time while Tonight is on screen, and logs a visit that ended too soon', async () => {
    const tree = await mount({ moment: 'before_lock', callShown: true });
    advance(REMINDER_SHEET_DELAY_MS - 1);
    mockFocused = false;
    act(() => tree.update(<Probe moment="before_lock" callShown />));
    advance(REMINDER_SHEET_DELAY_MS);
    expect(latest!.visible).toBe(false);
    expect(skips()).toEqual([{ reason: 'left_early', moment: 'before_lock' }]);
    // Back on Tonight: the wait starts over.
    mockFocused = true;
    act(() => tree.update(<Probe moment="before_lock" callShown />));
    advance(REMINDER_SHEET_DELAY_MS - 1);
    expect(latest!.visible).toBe(false);
    advance(1);
    expect(latest!.visible).toBe(true);
    act(() => tree.unmount());
  });

  it('treats the app going to the background as the end of a visit', async () => {
    mockReminders = { ...mockReminders, permission: 'denied' };
    const tree = await mount({ moment: 'after_lock', callShown: true });
    act(() => mockAppStateListener!('background'));
    expect(skips()).toEqual([{ reason: 'permission_denied', moment: 'after_lock' }]);
    act(() => tree.unmount());
  });

  it('logs each reason once a day, not on every visit', async () => {
    mockReminders = { settings: { enabled: true, minutesBefore: 30, liveStart: false }, permission: 'granted' };
    const tree = await mount({ moment: null, callShown: false });
    for (let visit = 0; visit < 3; visit += 1) {
      act(() => mockAppStateListener!('background'));
      act(() => mockAppStateListener!('active'));
    }
    act(() => tree.unmount());
    expect(skips()).toEqual([{ reason: 'reminders_on', moment: null }]);
  });

  it('logs the cooldown on the visit after "Not now", but not the visit it was answered on', async () => {
    const tree = await mount({ moment: 'before_lock', callShown: true });
    advance(REMINDER_SHEET_DELAY_MS);
    act(() => latest!.dismiss());
    expect(latest!.visible).toBe(false);
    act(() => mockAppStateListener!('background'));
    expect(skips()).toEqual([]);
    act(() => mockAppStateListener!('active'));
    act(() => mockAppStateListener!('background'));
    expect(skips()).toEqual([{ reason: 'cooling_down', moment: 'before_lock' }]);
    act(() => tree.unmount());
  });
});
