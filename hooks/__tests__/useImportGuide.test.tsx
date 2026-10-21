import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import { useImportGuide, type ImportGuideState } from '../useImportGuide';
import type { HostLink } from '../../services/fantasy/hostLinks';

const mockTrack = jest.fn();
const mockOpenHost = jest.fn();
let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: () => { mockAppStateListener = null; } };
    },
  },
}));
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('../../services/native/deviceLinks', () => ({ openFantasyHost: (...args: unknown[]) => mockOpenHost(...args) }));

const YAHOO: HostLink = { name: 'Yahoo', url: 'https://hockey.fantasysports.yahoo.com/', teamPage: false };
let latest: ImportGuideState;
let tree: any;
function Probe({ host }: { host: HostLink | null }) { latest = useImportGuide(true, 'onboarding', host); return null; }
beforeEach(() => { jest.clearAllMocks(); mockOpenHost.mockResolvedValue('opened'); });
afterEach(() => act(() => tree?.unmount()));
async function show(host: HostLink | null = YAHOO) { await act(async () => { tree = create(<Probe host={host} />); }); }

it('opens the league app and greets the user when PuckIQ comes back', async () => {
  await show();
  await act(async () => latest.openHost());
  expect(mockOpenHost).toHaveBeenCalledWith(YAHOO, 'import_onboarding');
  expect(latest.guide).toBe('away');
  await act(async () => mockAppStateListener?.('active'));
  expect(latest.guide).toBe('returned');
  expect(mockTrack).toHaveBeenCalledWith('roster_import_return', expect.objectContaining({ source: 'onboarding' }));
});

it('ignores coming back to the app without a trip to the league app', async () => {
  await show();
  await act(async () => mockAppStateListener?.('active'));
  expect(latest.guide).toBe('start');
  expect(mockTrack).not.toHaveBeenCalled();
});

it('counts the in-app browser closing as coming back', async () => {
  mockOpenHost.mockResolvedValue('in_app_browser');
  await show();
  await act(async () => latest.openHost());
  expect(latest.guide).toBe('returned');
});

it('shows help after a cancelled pick and does nothing without a league app', async () => {
  await show(null);
  await act(async () => latest.openHost());
  expect(mockOpenHost).not.toHaveBeenCalled();
  await act(async () => latest.pickCancelled());
  expect(latest.guide).toBe('no_screenshots');
});
