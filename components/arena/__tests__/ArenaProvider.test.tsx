import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { addFavoriteTeam } from '../../../services/teamFavorites';
import { ArenaProvider, useArena } from '../ArenaProvider';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let mockAppStateListener: ((state: string) => void) | undefined;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: jest.fn() };
    }),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const stored = new Map<string, string>();
let latest: ReturnType<typeof useArena>;

function Probe() {
  latest = useArena();
  return null;
}

async function renderProbe(withProvider = true) {
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(withProvider ? <ArenaProvider><Probe /></ArenaProvider> : <Probe />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

describe('ArenaProvider', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return;
      }
      originalConsoleError(message, ...args);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stored.clear();
    mockAppStateListener = undefined;
    storage.getItem.mockImplementation(async (key) => stored.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { stored.set(key, value); });
    storage.removeItem.mockImplementation(async (key) => { stored.delete(key); });
  });

  it('offers neutral safe defaults outside a provider', async () => {
    const tree = await renderProbe(false);
    expect(latest.homeTeam).toBeNull();
    expect(latest.followedTeams).toEqual([]);
    expect(latest.loading).toBe(false);
    expect(latest.palette.action).toBe('#4CC9F0');
    await expect(latest.refreshTeams()).resolves.toBeUndefined();
    act(() => { tree.unmount(); });
  });

  it('hydrates the persisted followed home team', async () => {
    stored.set('puckiq_favorite_teams', JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-08T12:00:00.000Z' },
      { triCode: 'VAN', fullName: 'Vancouver Canucks', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    stored.set('puckiq_home_team', 'VAN');
    const tree = await renderProbe();
    expect(latest.homeTeam?.abbrev).toBe('VAN');
    expect(latest.palette.hero).toBe('#005DAA');
    expect(latest.loading).toBe(false);
    act(() => { tree.unmount(); });
  });

  it('uses the first follow as home and retains it across more follows', async () => {
    const tree = await renderProbe();
    await act(async () => { await latest.followTeam('edm'); });
    expect(latest.homeTeam?.abbrev).toBe('EDM');
    expect(latest.followedTeams[0].fullName).toBe('Edmonton Oilers');

    await act(async () => { await latest.followTeam('VAN'); });
    expect(latest.homeTeam?.abbrev).toBe('EDM');
    expect(latest.followedTeams.map((team) => team.triCode)).toEqual(['EDM', 'VAN']);
    act(() => { tree.unmount(); });
  });

  it('preserves the selected home team across a temporary favorites read failure', async () => {
    stored.set('puckiq_favorite_teams', JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-08T12:00:00.000Z' },
      { triCode: 'VAN', fullName: 'Vancouver Canucks', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    stored.set('puckiq_home_team', 'VAN');
    const tree = await renderProbe();
    storage.getItem.mockRejectedValueOnce(new Error('temporarily unavailable'));
    await act(async () => {
      await expect(latest.refreshTeams()).rejects.toThrow('temporarily unavailable');
    });
    expect(latest.homeTeam?.abbrev).toBe('VAN');
    expect(stored.get('puckiq_home_team')).toBe('VAN');
    await act(async () => { await latest.refreshTeams(); });
    expect(latest.homeTeam?.abbrev).toBe('VAN');
    act(() => { tree.unmount(); });
  });

  it('rejects an unfollowed or inactive home team without writing it', async () => {
    const tree = await renderProbe();
    await expect(latest.chooseHomeTeam('VAN')).rejects.toThrow('Home team must be followed');
    await expect(latest.followTeam('ARI')).rejects.toThrow('Unknown active NHL team: ARI');
    expect(stored.has('puckiq_home_team')).toBe(false);
    act(() => { tree.unmount(); });
  });

  it('falls back by earliest addedAt and preserves array order for ties', async () => {
    stored.set('puckiq_favorite_teams', JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-08T12:00:00.000Z' },
      { triCode: 'VAN', fullName: 'Vancouver Canucks', addedAt: '2026-09-07T12:00:00.000Z' },
      { triCode: 'SEA', fullName: 'Seattle Kraken', addedAt: '2026-09-07T12:00:00.000Z' },
    ]));
    stored.set('puckiq_home_team', 'EDM');
    const tree = await renderProbe();
    await act(async () => { await latest.unfollowTeam('EDM'); });
    expect(latest.homeTeam?.abbrev).toBe('VAN');
    expect(stored.get('puckiq_home_team')).toBe('VAN');
    act(() => { tree.unmount(); });
  });

  it('reacts to favorite mutations made outside the provider', async () => {
    const tree = await renderProbe();
    await act(async () => { await addFavoriteTeam('EDM', 'Edmonton Oilers'); await Promise.resolve(); });
    expect(latest.followedTeams.map((team) => team.triCode)).toEqual(['EDM']);
    expect(latest.homeTeam?.abbrev).toBe('EDM');
    act(() => { tree.unmount(); });
  });

  it('reloads persisted teams when the app becomes active', async () => {
    const tree = await renderProbe();
    stored.set('puckiq_favorite_teams', JSON.stringify([
      { triCode: 'SEA', fullName: 'Seattle Kraken', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    stored.set('puckiq_home_team', 'SEA');
    await act(async () => {
      mockAppStateListener?.('active');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest.homeTeam?.abbrev).toBe('SEA');
    act(() => { tree.unmount(); });
  });

  it('serializes a follow requested while initial hydration is pending', async () => {
    let resolveInitialFavorites!: (value: string | null) => void;
    let delayInitialFavorites = true;
    storage.getItem.mockImplementation((key) => {
      if (key === 'puckiq_favorite_teams' && delayInitialFavorites) {
        delayInitialFavorites = false;
        return new Promise((resolve) => { resolveInitialFavorites = resolve; });
      }
      return Promise.resolve(stored.get(key) ?? null);
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ArenaProvider><Probe /></ArenaProvider>);
      await Promise.resolve();
    });
    const follow = latest.followTeam('EDM');
    resolveInitialFavorites(null);
    await act(async () => { await follow; });

    expect(latest.homeTeam?.abbrev).toBe('EDM');
    expect(latest.followedTeams.map((team) => team.triCode)).toEqual(['EDM']);
    act(() => { tree!.unmount(); });
  });

  it('does not publish a failed home-team write', async () => {
    stored.set('puckiq_favorite_teams', JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-08T12:00:00.000Z' },
      { triCode: 'VAN', fullName: 'Vancouver Canucks', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    stored.set('puckiq_home_team', 'EDM');
    const tree = await renderProbe();
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(latest.chooseHomeTeam('VAN')).rejects.toThrow('disk full');
    expect(latest.homeTeam?.abbrev).toBe('EDM');
    act(() => { tree.unmount(); });
  });
});
