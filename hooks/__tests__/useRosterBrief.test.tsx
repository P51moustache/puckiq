import React from 'react';
// @ts-expect-error no declaration for react-test-renderer
import { act, create } from 'react-test-renderer';
import { createTeam } from '../../services/teams';
import { player } from '../../services/fantasy/__tests__/fixtures';
import { useRosterBrief } from '../useRosterBrief';
import type { NightView } from '../useCoach';
import type { RosterSnapshot } from '../../services/engagement/rosterBrief';

let mockFocused = true;
let mockStateChange: (value: string) => void;
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(async (_key: string, _value: string) => undefined) };
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: (_: string, callback: typeof mockStateChange) => { mockStateChange = callback; return { remove: jest.fn() }; } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: [string, string]) => mockStorage.setItem(...args) } }));
jest.mock('../../services/analytics/track', () => ({ track: jest.fn() }));
const team = createTeam({ players: [player(8478402, 'Center', 'EDM', 'C')] });
const now = Date.parse('2026-10-13T16:00:00Z');
const snapshot: RosterSnapshot = { schema: 1, date: '2026-10-13', checkedAt: now - 1000, players: [{ id: 8478402, signal: 'ok', confidence: 'unknown', goalie: null }], empty: { D: 0 } };
const view = { date: snapshot.date, checks: [{ label: 'Schedule', check: { source: 'test', fetchedAt: now - 500, maxAgeMs: 60_000, state: 'fresh' } }], bestDay: { empty: ['D'] }, night: { data: { statuses: new Map() } }, goalieOutlooks: new Map(), loading: false, error: null } as unknown as NightView;
let result: ReturnType<typeof useRosterBrief>;
function Probe({ currentView = view, currentTeam = team }: { currentView?: NightView; currentTeam?: typeof team }) { result = useRosterBrief(currentTeam, currentView, true); return null; }
let tree: any;
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  mockStorage.getItem.mockResolvedValue(JSON.stringify(snapshot));
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null; jest.restoreAllMocks();
});

it('shows changes against the prior visit, dismisses them, then commits on blur', async () => {
  await act(async () => { tree = create(<Probe />); });
  expect(result.items.map((item) => item.kind)).toEqual(['slot_gap']);
  expect(mockStorage.setItem).not.toHaveBeenCalled();
  act(() => result.dismiss());
  expect(result.items).toEqual([]);
  mockFocused = false;
  await act(async () => tree.update(<Probe />));
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1]).empty.D).toBe(1);
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1]).checkedAt).toBe(now - 500);
  mockFocused = true;
  await act(async () => tree.update(<Probe />));
  expect(result.items).toEqual([]);
});

it('does not create first-visit changes or persist failed loads', async () => {
  mockStorage.getItem.mockResolvedValue(null);
  const failed = { ...view, loading: true };
  await act(async () => { tree = create(<Probe currentView={failed} />); });
  expect(result.items).toEqual([]);
  await act(async () => mockStateChange('background'));
  expect(mockStorage.setItem).not.toHaveBeenCalled();
  await act(async () => mockStateChange('active'));
  await act(async () => tree.update(<Probe />));
  expect(result.items).toEqual([]);
  await act(async () => mockStateChange('background'));
  expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
});

it('keeps roster observations separate when teams change', async () => {
  await act(async () => { tree = create(<Probe />); });
  const other = { ...team, id: 'another-team' };
  await act(async () => tree.update(<Probe currentTeam={other} />));
  expect(mockStorage.setItem.mock.calls[0][0]).toBe(`puckiq_roster_brief_v1_${team.id}`);
  expect(mockStorage.getItem).toHaveBeenLastCalledWith('puckiq_roster_brief_v1_another-team');
});

it.each(['stale', 'unavailable'] as const)('does not show changes or persist a %s check as a fresh visit', async (state) => {
  const stale = { ...view, checks: [{ label: 'Scratch list', check: { ...view.checks[0].check, state } }] };
  await act(async () => { tree = create(<Probe currentView={stale} />); });
  expect(result.items).toEqual([]);
  await act(async () => mockStateChange('background'));
  expect(mockStorage.setItem).not.toHaveBeenCalled();
});

it('stops showing a cached comparison after its source expires', async () => {
  await act(async () => { tree = create(<Probe />); });
  expect(result.items).toHaveLength(1);
  jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
  await act(async () => tree.update(<Probe />));
  expect(result.items).toEqual([]);
});
