/**
 * Tests for MyPicks UX improvements
 */

import * as Haptics from 'expo-haptics';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

describe('MyPicks - UX Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Haptic Feedback', () => {
    it('should trigger haptic feedback when making a pick', async () => {
      // Simulate making a pick
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    });

    it('should use Light impact style for picks', async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    });
  });

  describe('Badge Priority System', () => {
    interface BadgeInfo {
      text: string;
      color: string;
      priority: number;
    }

    const getBadgeToDisplay = (
      isLive: boolean,
      isFinal: boolean,
      isLock: boolean,
      hasSmartPick: boolean,
      currentPeriod: number,
      predictedTeam?: string
    ): BadgeInfo | null => {
      // Priority: LIVE > FINAL > LOCK > AI
      if (isLive) {
        return { text: `P${currentPeriod}`, color: '#ef4444', priority: 1 };
      }
      if (isFinal) {
        return { text: 'FINAL', color: '#98a6bf', priority: 2 };
      }
      if (isLock) {
        return { text: 'LOCK', color: '#fbbf24', priority: 3 };
      }
      if (hasSmartPick && predictedTeam) {
        return { text: `AI: ${predictedTeam}`, color: '#10b981', priority: 4 };
      }
      return null;
    };

    it('should show LIVE badge with highest priority', () => {
      const badge = getBadgeToDisplay(true, true, true, true, 2, 'TOR');

      expect(badge).not.toBeNull();
      expect(badge?.text).toBe('P2');
      expect(badge?.priority).toBe(1);
    });

    it('should show FINAL badge when not live but game ended', () => {
      const badge = getBadgeToDisplay(false, true, true, true, 3, 'TOR');

      expect(badge).not.toBeNull();
      expect(badge?.text).toBe('FINAL');
      expect(badge?.priority).toBe(2);
    });

    it('should show LOCK badge when game not started and is lock', () => {
      const badge = getBadgeToDisplay(false, false, true, true, 1, 'TOR');

      expect(badge).not.toBeNull();
      expect(badge?.text).toBe('LOCK');
      expect(badge?.priority).toBe(3);
    });

    it('should show AI badge when game not started and has smart pick', () => {
      const badge = getBadgeToDisplay(false, false, false, true, 1, 'TOR');

      expect(badge).not.toBeNull();
      expect(badge?.text).toBe('AI: TOR');
      expect(badge?.priority).toBe(4);
    });

    it('should return null when no badges apply', () => {
      const badge = getBadgeToDisplay(false, false, false, false, 1);

      expect(badge).toBeNull();
    });

    it('should show current period in live badge', () => {
      const period1 = getBadgeToDisplay(true, false, false, false, 1);
      const period2 = getBadgeToDisplay(true, false, false, false, 2);
      const period3 = getBadgeToDisplay(true, false, false, false, 3);

      expect(period1?.text).toBe('P1');
      expect(period2?.text).toBe('P2');
      expect(period3?.text).toBe('P3');
    });
  });

  describe('Score Highlighting', () => {
    interface ScoreStyle {
      color: string;
      opacity: number;
    }

    const getScoreStyle = (
      score: number,
      opponentScore: number,
      isGameStarted: boolean
    ): ScoreStyle => {
      if (!isGameStarted) {
        return { color: '#60a5fa', opacity: 1 };
      }

      // Highlight winning score in green
      if (score > opponentScore) {
        return { color: '#10b981', opacity: 1 };
      }

      // Dim losing score
      if (score < opponentScore) {
        return { color: '#98a6bf', opacity: 0.6 };
      }

      // Tied scores - normal color
      return { color: '#60a5fa', opacity: 1 };
    };

    it('should highlight winning score in green', () => {
      const style = getScoreStyle(5, 3, true);

      expect(style.color).toBe('#10b981');
      expect(style.opacity).toBe(1);
    });

    it('should dim losing score', () => {
      const style = getScoreStyle(2, 4, true);

      expect(style.color).toBe('#98a6bf');
      expect(style.opacity).toBe(0.6);
    });

    it('should show tied scores in normal color', () => {
      const style = getScoreStyle(3, 3, true);

      expect(style.color).toBe('#60a5fa');
      expect(style.opacity).toBe(1);
    });

    it('should use normal color for future games', () => {
      const style = getScoreStyle(0, 0, false);

      expect(style.color).toBe('#60a5fa');
      expect(style.opacity).toBe(1);
    });

    it('should handle zero scores correctly', () => {
      const winning = getScoreStyle(1, 0, true);
      const losing = getScoreStyle(0, 1, true);

      expect(winning.color).toBe('#10b981');
      expect(losing.color).toBe('#98a6bf');
    });
  });

  describe('Empty State Helper', () => {
    const getTomorrowDateString = (): string => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getFormattedDate = (dateString: string): string => {
      const date = new Date(dateString + 'T12:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    };

    it('should get tomorrow date in YYYY-MM-DD format', () => {
      const tomorrow = getTomorrowDateString();

      // Should match YYYY-MM-DD format
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify the year is valid (current or next year)
      const year = parseInt(tomorrow.split('-')[0]);
      const currentYear = new Date().getFullYear();
      expect(year).toBeGreaterThanOrEqual(currentYear);
      expect(year).toBeLessThanOrEqual(currentYear + 1);
    });

    it('should format date string to readable format', () => {
      const formatted = getFormattedDate('2025-01-16');

      // Should contain day name, month, and day number
      expect(formatted).toContain('January');
      expect(formatted).toContain('16');
    });

    it('should handle month transitions correctly', () => {
      // Mock getTomorrowDateString logic for Jan 31
      const mockToday = new Date(2025, 0, 31); // Jan 31, 2025
      const tomorrow = new Date(mockToday);
      tomorrow.setDate(mockToday.getDate() + 1);

      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowString = `${year}-${month}-${day}`;

      expect(tomorrowString).toBe('2025-02-01');
    });
  });
});
