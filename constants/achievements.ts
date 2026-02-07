import type { Ionicons } from '@expo/vector-icons';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  requirement: {
    type: 'picks' | 'accuracy' | 'streak' | 'comparison' | 'consistency';
    value: number;
    streakType?: 'win' | 'loss';
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  // Pick milestone achievements
  {
    id: 'first_pick',
    title: 'First Pick',
    description: 'Make your first prediction',
    icon: 'locate-outline',
    requirement: {
      type: 'picks',
      value: 1,
    },
  },
  {
    id: 'analyst',
    title: 'Analyst',
    description: 'Make 10 picks',
    icon: 'stats-chart-outline',
    requirement: {
      type: 'picks',
      value: 10,
    },
  },
  {
    id: 'expert',
    title: 'Expert',
    description: 'Make 50 picks',
    icon: 'trophy-outline',
    requirement: {
      type: 'picks',
      value: 50,
    },
  },
  {
    id: 'master',
    title: 'Master',
    description: 'Make 100 picks',
    icon: 'diamond-outline',
    requirement: {
      type: 'picks',
      value: 100,
    },
  },
  {
    id: 'legend',
    title: 'Legend',
    description: 'Make 250 picks',
    icon: 'ribbon-outline',
    requirement: {
      type: 'picks',
      value: 250,
    },
  },

  // Accuracy achievements
  {
    id: 'student',
    title: 'Student',
    description: 'Reach 60% accuracy',
    icon: 'school-outline',
    requirement: {
      type: 'accuracy',
      value: 60,
    },
  },
  {
    id: 'professor',
    title: 'Professor',
    description: 'Reach 70% accuracy',
    icon: 'book-outline',
    requirement: {
      type: 'accuracy',
      value: 70,
    },
  },
  {
    id: 'genius',
    title: 'Genius',
    description: 'Reach 80% accuracy',
    icon: 'bulb-outline',
    requirement: {
      type: 'accuracy',
      value: 80,
    },
  },

  // Streak achievements
  {
    id: 'hot_streak',
    title: 'Hot Streak',
    description: 'Win 5 picks in a row',
    icon: 'flame',
    requirement: {
      type: 'streak',
      value: 5,
      streakType: 'win',
    },
  },
  {
    id: 'lightning_round',
    title: 'Lightning Round',
    description: 'Win 10 picks in a row',
    icon: 'flash',
    requirement: {
      type: 'streak',
      value: 10,
      streakType: 'win',
    },
  },
  {
    id: 'perfect_week',
    title: 'Perfect Week',
    description: 'Win 7 picks in a row',
    icon: 'star-outline',
    requirement: {
      type: 'streak',
      value: 7,
      streakType: 'win',
    },
  },
  {
    id: 'unstoppable',
    title: 'Unstoppable',
    description: 'Win 15 picks in a row',
    icon: 'rocket-outline',
    requirement: {
      type: 'streak',
      value: 15,
      streakType: 'win',
    },
  },

  // Comparison achievement
  {
    id: 'better_than_ai',
    title: 'Better Than AI',
    description: 'Beat Smart Picks accuracy',
    icon: 'hardware-chip-outline',
    requirement: {
      type: 'comparison',
      value: 0, // Will be checked dynamically
    },
  },

  // Consistency achievement
  {
    id: 'dedicated',
    title: 'Dedicated',
    description: 'Make picks on 7 consecutive days',
    icon: 'calendar-outline',
    requirement: {
      type: 'consistency',
      value: 7,
    },
  },
];

// Function to check if an achievement is unlocked
export function checkAchievement(
  achievement: Achievement,
  stats: {
    totalPicks: number;
    accuracy: number;
    bestStreak: number;
    userAccuracy: number;
    smartPickAccuracy: number;
    consecutiveDays: number;
  }
): { unlocked: boolean; progress: number } {
  switch (achievement.requirement.type) {
    case 'picks':
      return {
        unlocked: stats.totalPicks >= achievement.requirement.value,
        progress: Math.min(100, (stats.totalPicks / achievement.requirement.value) * 100),
      };

    case 'accuracy':
      return {
        unlocked: stats.accuracy >= achievement.requirement.value,
        progress: Math.min(100, (stats.accuracy / achievement.requirement.value) * 100),
      };

    case 'streak':
      return {
        unlocked: stats.bestStreak >= achievement.requirement.value,
        progress: Math.min(100, (stats.bestStreak / achievement.requirement.value) * 100),
      };

    case 'comparison':
      return {
        unlocked: stats.userAccuracy > stats.smartPickAccuracy && stats.totalPicks >= 10,
        progress: stats.totalPicks >= 10 ? (stats.userAccuracy > stats.smartPickAccuracy ? 100 : 50) : (stats.totalPicks / 10) * 50,
      };

    case 'consistency':
      return {
        unlocked: stats.consecutiveDays >= achievement.requirement.value,
        progress: Math.min(100, (stats.consecutiveDays / achievement.requirement.value) * 100),
      };

    default:
      return { unlocked: false, progress: 0 };
  }
}

// Get all achievements with their unlock status
export function getAchievementsWithStatus(stats: {
  totalPicks: number;
  accuracy: number;
  bestStreak: number;
  userAccuracy: number;
  smartPickAccuracy: number;
  consecutiveDays: number;
}): Array<Achievement & { unlocked: boolean; progress: number }> {
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    ...checkAchievement(achievement, stats),
  }));
}
