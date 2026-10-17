import { openHostLink } from '../openHostLink';
import type { WebLinkResult } from '../../native/safeOpen';

const host = { name: 'Yahoo', teamPage: true, url: 'https://hockey.fantasysports.yahoo.com/hockey/private-league/6' };

async function landed(result: WebLinkResult) {
  const emit = jest.fn();
  const open = jest.fn().mockResolvedValue(result);
  await expect(openHostLink(host, 'lineup', open, emit)).resolves.toBe(result);
  expect(open).toHaveBeenCalledWith(host.url);
  return emit;
}

it('separates an attempted link from where it landed without exposing a private team URL', async () => {
  const emit = await landed('opened');
  expect(emit.mock.calls.map(([event]) => event)).toEqual(['host_open', 'host_open_result']);
  expect(emit).toHaveBeenNthCalledWith(1, 'host_open', { host: 'yahoo', team_page: true, source: 'lineup' });
  expect(emit).toHaveBeenLastCalledWith('host_open_result', { host: 'yahoo', team_page: true, source: 'lineup', result: 'opened' });
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private-league');
});

it('reports the in-app browser and alert fallbacks so analytics can tell them apart', async () => {
  expect(await landed('in_app_browser')).toHaveBeenLastCalledWith('host_open_result', expect.objectContaining({ result: 'in_app_browser' }));
  expect(await landed('alerted')).toHaveBeenLastCalledWith('host_open_result', expect.objectContaining({ result: 'alerted' }));
});

it('still reports a result, without the error text, if the opener itself throws', async () => {
  const emit = jest.fn();
  await expect(openHostLink(host, 'lineup', () => Promise.reject(new Error('private data')), emit)).resolves.toBe('failed');
  expect(emit).toHaveBeenLastCalledWith('host_open_result', expect.objectContaining({ result: 'failed' }));
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private data');
});
