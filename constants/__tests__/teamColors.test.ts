import { getTeamColors, getAccessibleTextColor } from '../teamColors';
import type { TeamColors } from '../teamColors';

const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WPG', 'WSH',
];

describe('teamColors', () => {
  describe('getTeamColors', () => {
    it.each(ALL_TEAMS)('returns colors for %s', (team) => {
      const colors = getTeamColors(team);
      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('secondary');
      expect(colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('returns default colors for unknown team abbreviation', () => {
      const colors = getTeamColors('XYZ');
      expect(colors.primary).toBe('#60a5fa');
      expect(colors.secondary).toBe('#334e8d');
    });

    it('returns default colors for empty string', () => {
      const colors = getTeamColors('');
      expect(colors.primary).toBe('#60a5fa');
    });

    it('also has ARI entry for legacy Arizona', () => {
      const colors = getTeamColors('ARI');
      expect(colors.primary).toBeTruthy();
      expect(colors.primary).not.toBe('#60a5fa'); // Not the default
    });

    it('returns distinct colors for different teams', () => {
      const tor = getTeamColors('TOR');
      const mtl = getTeamColors('MTL');
      expect(tor.primary).not.toBe(mtl.primary);
    });
  });

  describe('getAccessibleTextColor', () => {
    const DARK_BLUE_TEAMS = ['NYR', 'TOR', 'TBL', 'BUF', 'CBJ', 'NYI', 'STL', 'WPG', 'VAN'];
    const BRIGHT_TEAMS = ['BOS', 'PIT', 'NSH', 'PHI', 'EDM', 'ANA', 'SEA'];

    it.each(ALL_TEAMS)('returns a valid hex color for %s', (team) => {
      const color = getAccessibleTextColor(team);
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('returns a valid hex color for unknown team', () => {
      const color = getAccessibleTextColor('XYZ');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it.each(DARK_BLUE_TEAMS)('lightens dark blue team %s for contrast', (team) => {
      const original = getTeamColors(team).primary;
      const accessible = getAccessibleTextColor(team);
      // Accessible color should be different (lightened) from the dark original
      expect(accessible).not.toBe(original);
    });

    it.each(BRIGHT_TEAMS)('keeps bright team %s color unchanged', (team) => {
      const original = getTeamColors(team).primary;
      const accessible = getAccessibleTextColor(team);
      // Bright colors already pass contrast, should be unchanged
      expect(accessible).toBe(original);
    });

    it('lightened colors are brighter than originals for dark teams', () => {
      // Helper to compute perceived brightness
      const brightness = (hex: string) => {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
      };

      for (const team of DARK_BLUE_TEAMS) {
        const original = getTeamColors(team).primary;
        const accessible = getAccessibleTextColor(team);
        if (accessible !== original) {
          expect(brightness(accessible)).toBeGreaterThan(brightness(original));
        }
      }
    });
  });
});
