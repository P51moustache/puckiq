import { openHostLink } from '../openHostLink';

it('separates an attempted link from success without exposing a private team URL', async () => {
  const emit = jest.fn();
  const host = { name: 'Yahoo', teamPage: true, url: 'https://hockey.fantasysports.yahoo.com/hockey/private-league/6' };
  const open = jest.fn().mockResolvedValue(undefined);
  await openHostLink(host, 'lineup', open, emit);
  expect(open).toHaveBeenCalledWith(host.url);
  expect(emit.mock.calls.map(([event]) => event)).toEqual(['host_open', 'host_open_result']);
  expect(emit).toHaveBeenLastCalledWith('host_open_result', { host: 'yahoo', team_page: true, source: 'lineup', result: 'opened' });
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private-league');
  await openHostLink(host, 'lineup', () => Promise.reject(new Error('private data')), emit);
  expect(emit).toHaveBeenLastCalledWith('host_open_result', expect.objectContaining({ result: 'failed' }));
});
