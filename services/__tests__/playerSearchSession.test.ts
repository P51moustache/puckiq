import { PlayerSearchSession } from '../playerSearchSession';

describe('PlayerSearchSession', () => {
  it('marks an older response stale when a newer query finishes first', async () => {
    const pending = new Map<string, (value: string[]) => void>();
    const session = new PlayerSearchSession<string>((query) => new Promise(resolve => pending.set(query, resolve)));
    const oldRequest = session.search('co');
    const latestRequest = session.search('connor');
    pending.get('connor')!(['Connor McDavid']);
    await expect(latestRequest).resolves.toEqual({ kind: 'success', results: ['Connor McDavid'] });
    pending.get('co')!(['Cole Caufield']);
    await expect(oldRequest).resolves.toEqual({ kind: 'stale' });
  });

  it('distinguishes an empty successful search from a failed search', async () => {
    const empty = new PlayerSearchSession<string>(async () => []);
    await expect(empty.search('nobody')).resolves.toEqual({ kind: 'success', results: [] });
    const failed = new PlayerSearchSession<string>(async () => { throw new Error('offline'); });
    await expect(failed.search('connor')).resolves.toEqual({ kind: 'error' });
  });
});
