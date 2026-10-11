import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import { useResource, type Resource } from '../useResource';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let latest!: Resource<string>;
let renderer: { update: (element: React.ReactElement) => void; unmount: () => void };
function Probe({ resourceKey, load }: { resourceKey: string | null; load: () => Promise<string> }) {
  latest = useResource(resourceKey, load);
  return null;
}
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    original(...args);
  });
});
afterAll(() => jest.restoreAllMocks());
afterEach(() => act(() => renderer?.unmount()));
async function show(key: string | null, load: () => Promise<string>) {
  await act(async () => { renderer = create(<Probe resourceKey={key} load={load} />); });
}
it('hides the old date immediately and rejects an obsolete result', async () => {
  const first = deferred(); const next = deferred();
  await show('first', () => first.promise);
  await act(async () => renderer.update(<Probe resourceKey="next" load={() => next.promise} />));
  await act(async () => first.resolve('wrong date'));
  expect(latest.data).toBeNull(); expect(latest.loading).toBe(true);
  await act(async () => next.resolve('right date'));
  expect(latest.data).toBe('right date');
});
it('does not retain loaded data when the team changes', async () => {
  await show('team-a', async () => 'team-a');
  const next = deferred();
  await act(async () => renderer.update(<Probe resourceKey="team-b" load={() => next.promise} />));
  expect(latest.data).toBeNull(); expect(latest.error).toBeNull();
});
it('cancels a disabled resource, including refresh', async () => {
  const pending = deferred(); const load = jest.fn(() => pending.promise);
  await show('active', load);
  await act(async () => renderer.update(<Probe resourceKey={null} load={load} />));
  await act(async () => { pending.resolve('obsolete'); await latest.refresh(); });
  expect(latest).toMatchObject({ data: null, error: null, loading: false, refreshing: false });
  expect(load).toHaveBeenCalledTimes(1);
});
it('preserves same-key data on refresh failure and exposes the failure', async () => {
  const load = jest.fn().mockResolvedValueOnce('real data').mockRejectedValueOnce(new Error('Offline'));
  await show('same', load);
  await act(async () => latest.refresh());
  expect(latest).toMatchObject({ data: 'real data', error: 'Offline', loading: false, refreshing: false });
});
