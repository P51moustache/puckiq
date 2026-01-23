import { WeeklyTheme } from '../types/weeklyTheme';

export { WeeklyTheme };

export const THEME_ROTATION: WeeklyTheme[] = [
  {
    id: 'home-ice',
    name: 'Home Ice Advantage',
    description: 'How playing at home affects outcomes',
    factorType: 'HOME_ICE',
    lessonIntro: 'Home teams win about 55% of NHL games. This week, we explore why the home crowd, last change, and familiar surroundings matter.',
    difficulty: 'fundamental',
  },
  {
    id: 'goaltending',
    name: 'Goaltending',
    description: 'The impact of hot and cold goalies',
    factorType: 'GOALIE_EDGE',
    lessonIntro: 'A hot goalie can steal games. A cold one can sink a favorite. This week, we track how goalie performance affects outcomes.',
    difficulty: 'fundamental',
  },
  {
    id: 'rest-fatigue',
    name: 'Rest & Fatigue',
    description: 'How rest and schedule affect performance',
    factorType: 'REST',
    lessonIntro: "Back-to-back games, long road trips, and schedule density all matter. This week, we see when fatigue is real and when it's overrated.",
    difficulty: 'fundamental',
  },
  {
    id: 'recent-form',
    name: 'Recent Form',
    description: 'Riding hot streaks and cold slumps',
    factorType: 'RECENT_FORM',
    lessonIntro: 'Teams get hot. Teams go cold. This week, we learn how to read momentum and when streaks are predictive.',
    difficulty: 'fundamental',
  },
  {
    id: 'special-teams',
    name: 'Special Teams',
    description: 'Power plays and penalty kills',
    factorType: 'SPECIAL_TEAMS',
    lessonIntro: 'Special teams can swing games. This week, we explore how power play and penalty kill percentages predict winners.',
    difficulty: 'intermediate',
  },
  {
    id: 'divisional',
    name: 'Divisional Rivalries',
    description: 'When familiarity breeds unpredictability',
    factorType: 'DIVISIONAL',
    lessonIntro: 'Division games are different. Teams know each other. This week, we see how familiarity affects predictions.',
    difficulty: 'intermediate',
  },
  {
    id: 'back-to-back',
    name: 'Back-to-Back Games',
    description: 'The real impact of no rest',
    factorType: 'BACK_TO_BACK',
    lessonIntro: 'Everyone talks about back-to-backs. But how much do they actually matter? This week, we find out.',
    difficulty: 'intermediate',
  },
  {
    id: 'head-to-head',
    name: 'Head-to-Head History',
    description: 'When past matchups predict future results',
    factorType: 'HEAD_TO_HEAD',
    lessonIntro: 'Some teams just own other teams. This week, we explore when head-to-head history matters.',
    difficulty: 'intermediate',
  },
];

// Season start date - themes rotate from here
const SEASON_START = new Date('2025-10-06');

export function getWeekNumber(date: Date): number {
  const diffTime = date.getTime() - SEASON_START.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

export function getThemeForDate(date: Date): WeeklyTheme {
  const weekNum = getWeekNumber(date);
  const themeIndex = weekNum % THEME_ROTATION.length;
  return THEME_ROTATION[themeIndex];
}

export function getCurrentTheme(): WeeklyTheme {
  return getThemeForDate(new Date());
}
