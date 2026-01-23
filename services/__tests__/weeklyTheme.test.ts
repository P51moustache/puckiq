import {
  WeeklyTheme,
  getCurrentTheme,
  getThemeForDate,
  THEME_ROTATION,
} from '../weeklyTheme';

describe('weeklyTheme', () => {
  describe('getCurrentTheme', () => {
    it('should return a valid theme', () => {
      const theme = getCurrentTheme();

      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.description).toBeDefined();
      expect(theme.factorType).toBeDefined();
    });
  });

  describe('getThemeForDate', () => {
    it('should return consistent theme for same week', () => {
      const monday = new Date('2026-01-19');
      const wednesday = new Date('2026-01-21');

      const mondayTheme = getThemeForDate(monday);
      const wednesdayTheme = getThemeForDate(wednesday);

      expect(mondayTheme.id).toBe(wednesdayTheme.id);
    });

    it('should return different theme for different weeks', () => {
      const week1 = new Date('2026-01-19');
      const week2 = new Date('2026-01-26');

      const theme1 = getThemeForDate(week1);
      const theme2 = getThemeForDate(week2);

      expect(theme1.id).not.toBe(theme2.id);
    });
  });

  describe('THEME_ROTATION', () => {
    it('should have at least 8 themes', () => {
      expect(THEME_ROTATION.length).toBeGreaterThanOrEqual(8);
    });

    it('should have unique IDs', () => {
      const ids = THEME_ROTATION.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
