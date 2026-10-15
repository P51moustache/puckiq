import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import { useRosterImport, type RosterImport } from '../useRosterImport';

const mockTrack = jest.fn();
const mockFetch = jest.fn().mockResolvedValue([]);
const mockScan = jest.fn();
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('../../services/nhl/rosters', () => ({ fetchAllRosters: () => mockFetch() }));
jest.mock('../../services/native/rosterScanner', () => ({ scanRosterScreenshots: () => mockScan(), rosterScannerSupported: () => true }));
let latest: RosterImport;
let tree: any;
const ids = new Set<number>();
function Probe() { latest = useRosterImport(true, ids, 'onboarding'); return null; }
beforeEach(() => { jest.clearAllMocks(); mockFetch.mockResolvedValue([]); });
afterEach(() => act(() => tree?.unmount()));
async function show() { await act(async () => { tree = create(<Probe />); }); }

it('distinguishes cancelling the picker from an import failure', async () => {
  mockScan.mockResolvedValue(null);
  await show();
  await act(async () => latest.scan());
  expect(latest.stage.kind).toBe('choose');
  expect(mockTrack).toHaveBeenCalledWith('roster_import_cancelled', expect.objectContaining({ source: 'onboarding', method: 'screenshot' }));
  expect(mockTrack.mock.calls.some(([event]) => event === 'roster_import_failure')).toBe(false);
});

it('reports scanner failures by category without publishing screenshot or error content', async () => {
  mockScan.mockRejectedValue(new Error('Private screenshot content'));
  await show();
  await act(async () => latest.scan());
  expect(latest.stage.kind).toBe('error');
  expect(mockTrack).toHaveBeenCalledWith('roster_import_failure', expect.objectContaining({ reason: 'scan_failed' }));
  expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('Private');
});

it('records failed roster loading instead of leaving the import stuck reading', async () => {
  mockFetch.mockRejectedValue(new Error('Private backend details'));
  await show();
  await act(async () => latest.paste('Private pasted player names'));
  expect(latest.stage.kind).toBe('error');
  expect(mockTrack).toHaveBeenCalledWith('roster_import_failure', expect.objectContaining({ reason: 'rosters_unavailable', method: 'paste' }));
  expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('Private');
});

it('does not resurrect an old match review after starting over', async () => {
  let finish!: (rows: never[]) => void;
  mockFetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await show();
  let pending!: Promise<void>;
  act(() => { pending = latest.paste(''); });
  expect(latest.stage.kind).toBe('reading');
  act(() => latest.restart());
  await act(async () => { finish([]); await pending; });
  expect(latest.stage.kind).toBe('choose');
  expect(mockTrack.mock.calls.some(([event]) => event === 'roster_import_result')).toBe(false);
});
