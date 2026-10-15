import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import { useBehaviorSnapshot } from '../useBehaviorSnapshot';

const mockTrack = jest.fn();
let mockFocused = true;
let mockStateChange: (next: string) => void;
const mockRemove = jest.fn();
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: (_: string, handler: typeof mockStateChange) => { mockStateChange = handler; return { remove: mockRemove }; } },
}));

function Probe({ state }: { state: string }) {
  useBehaviorSnapshot('tonight', { state, available_moves: 1 });
  return null;
}

it('does not count hidden tabs, background updates or identical re-renders as advice availability', () => {
  mockFocused = false;
  let tree: any;
  act(() => { tree = create(<Probe state="ready" />); });
  expect(mockTrack).not.toHaveBeenCalled();
  mockFocused = true;
  act(() => tree.update(<Probe state="ready" />));
  act(() => tree.update(<Probe state="ready" />));
  expect(mockTrack).toHaveBeenCalledTimes(1);
  act(() => mockStateChange('background'));
  act(() => tree.update(<Probe state="error" />));
  expect(mockTrack).toHaveBeenCalledTimes(1);
  act(() => mockStateChange('active'));
  expect(mockTrack).toHaveBeenLastCalledWith('advice_state', { surface: 'tonight', state: 'error', available_moves: 1 });
  act(() => tree.unmount());
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

it('measures visible loading until ready and departure without including hidden background time', () => {
  jest.clearAllMocks(); mockFocused = true;
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  let tree: any;
  act(() => { tree = create(<Probe state="loading" />); });
  now.mockReturnValue(4000);
  act(() => tree.update(<Probe state="ready" />));
  expect(mockTrack).toHaveBeenCalledWith('advice_load_result', { surface: 'tonight', result: 'ready', wait_ms: 3000 });
  now.mockReturnValue(5000);
  act(() => tree.update(<Probe state="loading" />));
  now.mockReturnValue(7000);
  act(() => mockStateChange('background'));
  expect(mockTrack).toHaveBeenCalledWith('advice_load_result', { surface: 'tonight', result: 'left_loading', wait_ms: 2000 });
  now.mockReturnValue(17000);
  act(() => tree.update(<Probe state="ready" />));
  act(() => mockStateChange('active'));
  expect(mockTrack.mock.calls.filter((call) => call[0] === 'advice_load_result')).toHaveLength(2);
  act(() => tree.unmount()); now.mockRestore();
});
