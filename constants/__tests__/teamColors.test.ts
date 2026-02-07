import { getTeamColors } from '../teamColors';
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
});
