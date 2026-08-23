import {
  espnFantasySync,
  FantasySyncNotReadyError,
  getFantasySyncAdapter,
  yahooFantasySync,
} from '../fantasySync';

describe('fantasySync stubs', () => {
  it('exposes Yahoo and ESPN adapters that are not available', () => {
    expect(yahooFantasySync.available).toBe(false);
    expect(espnFantasySync.available).toBe(false);
    expect(getFantasySyncAdapter('yahoo')).toBe(yahooFantasySync);
    expect(getFantasySyncAdapter('espn')).toBe(espnFantasySync);
  });

  it('throws a stable not-ready error so UI can show the stub message', async () => {
    await expect(yahooFantasySync.connectAndImport()).rejects.toBeInstanceOf(FantasySyncNotReadyError);
    await expect(espnFantasySync.connectAndImport()).rejects.toThrow(/ESPN/);
  });
});
