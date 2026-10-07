/**
 * widgetBridge: forwards JSON to NativeModules.PuckIQNative on iOS, and is a safe no-op when the
 * module (or NativeModules itself, under partial react-native mocks) is missing.
 */

const mockRN: { Platform: { OS: string }; NativeModules?: Record<string, unknown> } = { Platform: { OS: 'ios' } };
jest.mock('react-native', () => mockRN);

import {
  endLiveActivity,
  liveActivitiesSupported,
  publishWidgetSnapshot,
  startOrUpdateLiveActivity,
  type LiveActivityState,
  type WidgetSnapshot,
} from '../widgetBridge';

const snapshot: WidgetSnapshot = {
  updatedAt: '2026-10-06T23:00:00.000Z',
  date: '2026-10-06',
  teamName: 'Ice Breakers',
  playing: 16,
  total: 17,
  firstPuckUTC: '2026-10-06T23:00:00Z',
  players: [{ name: 'Connor McDavid', team: 'EDM', opponent: 'LAK', home: false, startUTC: '2026-10-06T23:00:00Z' }],
  live: null,
};

const state: LiveActivityState = {
  points: 23.5,
  live: 3,
  final: 2,
  upcoming: 1,
  topName: 'McDavid',
  topLine: '2G 1A',
  clock: 'P2 10:15',
};

function installNative() {
  const native = {
    setWidgetSnapshot: jest.fn((_json: string): Promise<void> => Promise.resolve()),
    liveActivitiesEnabled: jest.fn((): boolean => true),
    startOrUpdateLiveActivity: jest.fn((_attrs: string, _state: string): Promise<boolean> => Promise.resolve(true)),
    endLiveActivity: jest.fn((_state: string | null): Promise<void> => Promise.resolve()),
  };
  mockRN.NativeModules = { PuckIQNative: native };
  return native;
}

beforeEach(() => {
  mockRN.Platform.OS = 'ios';
  delete mockRN.NativeModules;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('without the native module', () => {
  it('is a no-op when NativeModules is undefined', async () => {
    expect(liveActivitiesSupported()).toBe(false);
    await expect(publishWidgetSnapshot(snapshot)).resolves.toBeUndefined();
    await expect(startOrUpdateLiveActivity({ teamName: 'Ice Breakers', date: '2026-10-06' }, state)).resolves.toBe(false);
    await expect(endLiveActivity(state)).resolves.toBeUndefined();
  });

  it('is a no-op off iOS even when a module exists', async () => {
    const native = installNative();
    mockRN.Platform.OS = 'android';
    expect(liveActivitiesSupported()).toBe(false);
    await publishWidgetSnapshot(snapshot);
    expect(native.setWidgetSnapshot).not.toHaveBeenCalled();
  });
});

describe('with the native module', () => {
  it('sends the snapshot and Live Activity payloads as JSON', async () => {
    const native = installNative();

    await publishWidgetSnapshot(snapshot);
    expect(JSON.parse(native.setWidgetSnapshot.mock.calls[0][0])).toEqual(snapshot);

    expect(liveActivitiesSupported()).toBe(true);

    await expect(startOrUpdateLiveActivity({ teamName: 'Ice Breakers', date: '2026-10-06' }, state)).resolves.toBe(true);
    const [attrs, sent] = native.startOrUpdateLiveActivity.mock.calls[0];
    expect(JSON.parse(attrs)).toEqual({ teamName: 'Ice Breakers', date: '2026-10-06' });
    expect(JSON.parse(sent)).toEqual(state);
  });

  it('ends with the final state, or with null to dismiss now', async () => {
    const native = installNative();
    await endLiveActivity(state);
    await endLiveActivity();
    expect(JSON.parse(native.endLiveActivity.mock.calls[0][0] ?? '')).toEqual(state);
    expect(native.endLiveActivity.mock.calls[1][0]).toBeNull();
  });

  it('swallows native failures', async () => {
    const native = installNative();
    native.setWidgetSnapshot.mockImplementation(() => Promise.reject(new Error('E_WIDGET_SNAPSHOT')));
    native.startOrUpdateLiveActivity.mockImplementation(() => Promise.reject(new Error('E_LIVE_ACTIVITY')));
    native.liveActivitiesEnabled.mockImplementation(() => {
      throw new Error('sync call failed');
    });

    await expect(publishWidgetSnapshot(snapshot)).resolves.toBeUndefined();
    await expect(startOrUpdateLiveActivity({ teamName: 'Ice Breakers', date: '2026-10-06' }, state)).resolves.toBe(false);
    expect(liveActivitiesSupported()).toBe(false);
  });
});
