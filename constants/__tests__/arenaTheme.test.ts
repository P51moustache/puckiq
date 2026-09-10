import sourceCatalog from '../../docs/design/arena-team-palettes.json';
import {
  ARENA_TEAMS,
  getArenaPalette,
  getArenaTeam,
} from '../arenaTheme';

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4)
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Arena team themes', () => {
  it('ships the exact 32 active-team catalog selected in the design', () => {
    expect(ARENA_TEAMS).toHaveLength(32);
    expect(ARENA_TEAMS).toEqual(sourceCatalog.teams);
    expect(new Set(ARENA_TEAMS.map((team) => team.abbrev)).size).toBe(32);
    expect(getArenaTeam('ARI')).toBeNull();
  });

  it('normalizes team lookups without accepting surrounding junk', () => {
    expect(getArenaTeam('edm')?.name).toBe('Edmonton Oilers');
    expect(getArenaTeam('EdM')?.tokens.hero).toBe('#2351C8');
    expect(getArenaTeam(' EDM ')).toBeNull();
    expect(getArenaTeam('unknown')).toBeNull();
  });

  it('keeps every text and surface pairing at WCAG AA contrast', () => {
    const pairs = [
      ['hero', 'heroInk'],
      ['action', 'actionInk'],
      ['frame', 'frameInk'],
      ['page', 'ink'],
      ['paper', 'ink'],
      ['soft', 'ink'],
      ['page', 'muted'],
      ['page', 'link'],
    ] as const;

    for (const team of ARENA_TEAMS) {
      for (const [background, foreground] of pairs) {
        expect(
          contrastRatio(team.tokens[background], team.tokens[foreground])
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('returns one stable neutral palette for absent and inactive teams', () => {
    const neutral = getArenaPalette();
    expect(getArenaPalette(null)).toBe(neutral);
    expect(getArenaPalette('ARI')).toBe(neutral);
    expect(neutral).toEqual({
      hero: '#26364D',
      heroInk: '#FFFFFF',
      action: '#4CC9F0',
      actionInk: '#111820',
      frame: '#172332',
      frameInk: '#FFFFFF',
      page: '#F7F9FC',
      paper: '#FFFFFF',
      soft: '#E8EEF5',
      edge: '#C8D3E0',
      ink: '#172332',
      muted: '#4C5A6B',
      link: '#146C85',
      focus: '#146C85',
    });
  });
});
