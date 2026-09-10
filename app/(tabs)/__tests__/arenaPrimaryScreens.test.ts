import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tabsDirectory = resolve(__dirname, '..');
const readScreen = (name: string) => readFileSync(resolve(tabsDirectory, name), 'utf8');

describe('Arena Club primary screens', () => {
  it('lets Following manage all teams without coupling follow to home selection', () => {
    const source = readScreen('following.tsx');

    expect(source).toContain('ARENA_TEAMS');
    expect(source).toContain('followTeam');
    expect(source).toContain('unfollowTeam');
    expect(source).toContain('chooseHomeTeam');
    expect(source).toContain('Make home');
    expect(source).toContain('Watched players');
  });

  it('builds League from a coherent standings snapshot and keeps analysis tools reachable', () => {
    const source = readScreen('stats.tsx');

    expect(source).toContain('fetchArenaStandings');
    expect(source).toContain('snapshot_date');
    expect(source).toContain('TeamHeadToHead');
    expect(source).toContain("router.push('/(tabs)/models')");
  });

  it('retains player search and detail while using the Arena shell', () => {
    const source = readScreen('players.tsx');

    expect(source).toContain('useArena');
    expect(source).toContain('ArenaHeader');
    expect(source).toContain('searchPlayers');
    expect(source).toContain('PlayerDetailModal');
    expect(source).toContain('headshotUrl');
  });
});
