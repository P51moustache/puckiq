export interface AdvancedMetric {
  id: string;
  name: string;
  shortDesc: string;
  whatItIs: string;
  whyItMatters: string;
  howToRead: string;
  thresholds: {
    elite: number;
    good: number;
    average: number;
    poor: number;
  };
  higherIsBetter: boolean;
  format: 'percentage' | 'decimal' | 'number' | 'ratio';
}

export const ADVANCED_METRICS: Record<string, AdvancedMetric> = {
  // POSSESSION METRICS
  corsiFor: {
    id: 'corsiFor',
    name: 'Corsi For %',
    shortDesc: 'Shot attempt differential',
    whatItIs: 'Corsi measures ALL shot attempts (shots on goal, missed shots, and blocked shots). Corsi For % is the percentage of all shot attempts that belong to your team while at even strength (5v5).',
    whyItMatters: 'Corsi is one of the best predictors of future success. Teams that control possession (high Corsi) tend to win more games. It shows which team is generating more offense and controlling the puck.',
    howToRead: 'A Corsi For % above 50% means your team attempts more shots than opponents. Elite teams typically sit above 52%, while struggling teams fall below 48%.',
    thresholds: {
      elite: 52,
      good: 50,
      average: 48,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  fenwickFor: {
    id: 'fenwickFor',
    name: 'Fenwick For %',
    shortDesc: 'Unblocked shot attempt differential',
    whatItIs: 'Similar to Corsi, but excludes blocked shots. Fenwick only counts shots on goal and missed shots (unblocked attempts).',
    whyItMatters: 'Fenwick removes the "noise" of blocked shots, which can be somewhat random. It gives a cleaner picture of shot quality and offensive pressure.',
    howToRead: 'Like Corsi, above 50% is good. Fenwick tends to be slightly more stable than Corsi because it removes defensive variance from blocked shots.',
    thresholds: {
      elite: 52,
      good: 50,
      average: 48,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  shotsOnGoalFor: {
    id: 'shotsOnGoalFor',
    name: 'Shots on Goal %',
    shortDesc: 'Shots that hit the net differential',
    whatItIs: 'The percentage of shots on goal (shots that reach the goalie) belonging to your team at even strength.',
    whyItMatters: 'While Corsi/Fenwick show shot attempts, this shows shot accuracy. Higher percentages mean your team is getting quality looks at the net.',
    howToRead: 'Above 50% means you\'re outshooting opponents. Elite offensive teams typically exceed 52%.',
    thresholds: {
      elite: 52,
      good: 50,
      average: 48,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  shotsOnGoalPct: {
    id: 'shotsOnGoalPct',
    name: 'Shots on Goal %',
    shortDesc: 'Shots that hit the net differential',
    whatItIs: 'The percentage of shots on goal (shots that reach the goalie) belonging to your team at even strength.',
    whyItMatters: 'While Corsi/Fenwick show shot attempts, this shows shot accuracy. Higher percentages mean your team is getting quality looks at the net.',
    howToRead: 'Above 50% means you\'re outshooting opponents. Elite offensive teams typically exceed 52%.',
    thresholds: {
      elite: 52,
      good: 50,
      average: 48,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  // SHOOTING & FINISHING METRICS
  pdo: {
    id: 'pdo',
    name: 'PDO',
    shortDesc: 'Shooting % + Save % (luck indicator)',
    whatItIs: 'PDO is the sum of a team\'s shooting percentage and save percentage at even strength. It\'s named after a blogger who popularized it.',
    whyItMatters: 'PDO is a "luck" indicator. The league average is always 100. Teams significantly above 100 are likely benefiting from good fortune (hot goaltending + high shooting %), while teams below 98 may be unlucky. Over time, PDO tends to regress to 100.',
    howToRead: 'PDO above 101.5 = likely lucky and due for regression. PDO between 99-101 = sustainable. PDO below 99 = unlucky and should improve. Use this to spot teams over/underperforming their talent.',
    thresholds: {
      elite: 101.5, // Actually means "lucky"
      good: 100.5,
      average: 99.5,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  expectedGoals: {
    id: 'expectedGoals',
    name: 'Expected Goals (xG)',
    shortDesc: 'Quality of scoring chances',
    whatItIs: 'xG estimates how many goals a team "should" score based on the quality of their shots. It factors in shot location, type, and situation to calculate probability.',
    whyItMatters: 'Not all shots are equal. A wrist shot from the slot is more dangerous than a shot from the blue line. xG separates shot quality from shot quantity.',
    howToRead: 'Higher xG = more dangerous chances. Compare xG to actual goals to see if a team is finishing above/below expectations or if their goalie is over/underperforming.',
    thresholds: {
      elite: 3.0, // per game
      good: 2.5,
      average: 2.0,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  xGDifferential: {
    id: 'xGDifferential',
    name: 'xG Differential',
    shortDesc: 'xG For - xG Against',
    whatItIs: 'The difference between expected goals for and expected goals against. Shows whether you\'re creating or allowing more quality chances.',
    whyItMatters: 'This is one of the best predictors of team success. Positive xG differential means you\'re controlling high-danger chances.',
    howToRead: 'Positive = creating more quality than allowing. Above +0.5 per game is elite territory. Negative xG diff is a red flag.',
    thresholds: {
      elite: 0.5,
      good: 0.2,
      average: -0.2,
      poor: -999,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  expectedGoalsDiff: {
    id: 'expectedGoalsDiff',
    name: 'xG Differential',
    shortDesc: 'xG For - xG Against',
    whatItIs: 'The difference between expected goals for and expected goals against. Shows whether you\'re creating or allowing more quality chances.',
    whyItMatters: 'This is one of the best predictors of team success. Positive xG differential means you\'re controlling high-danger chances.',
    howToRead: 'Positive = creating more quality than allowing. Above +0.5 per game is elite territory. Negative xG diff is a red flag.',
    thresholds: {
      elite: 0.5,
      good: 0.2,
      average: -0.2,
      poor: -999,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  highDangerChances: {
    id: 'highDangerChances',
    name: 'High Danger Chances For',
    shortDesc: 'Premium scoring opportunities',
    whatItIs: 'Shots from high-danger areas (slot, crease) where goals are most likely. These are the "grade A" chances.',
    whyItMatters: 'Generating high-danger chances is crucial for offensive success. Teams that dominate this category score more goals even with fewer total shots.',
    howToRead: 'More is better. Elite teams generate 10+ high-danger chances per game. Compare to opponents\' high-danger chances allowed.',
    thresholds: {
      elite: 10,
      good: 8,
      average: 6,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'number',
  },

  shootingTalent: {
    id: 'shootingTalent',
    name: 'Shooting Talent',
    shortDesc: 'Sustainable finishing ability',
    whatItIs: 'The portion of shooting percentage that appears to be skill-based rather than luck. Derived from historical shooting % stability.',
    whyItMatters: 'Separates teams with genuinely skilled shooters from teams running hot. Helps predict future goal-scoring sustainability.',
    howToRead: 'Above 11% = elite finishers. 9.5-11% = good. 8.5-9.5% = average. Below 8.5% = poor finishers.',
    thresholds: {
      elite: 11.0,
      good: 9.5,
      average: 8.5,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  // SPECIAL TEAMS METRICS
  powerPlayXG: {
    id: 'powerPlayXG',
    name: 'Power Play xG',
    shortDesc: 'Expected goals per PP opportunity',
    whatItIs: 'Expected goals generated per power play opportunity based on shot quality and location.',
    whyItMatters: 'Shows whether your PP is creating high-quality chances regardless of whether they convert. A PP can be "unlucky" with low conversion but good xG.',
    howToRead: 'Above 0.5 xG per PP = elite setup. 0.4-0.5 = good. 0.35-0.4 = average. Below 0.35 = struggling to generate danger.',
    thresholds: {
      elite: 0.50,
      good: 0.42,
      average: 0.36,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  penaltyKillXGA: {
    id: 'penaltyKillXGA',
    name: 'Penalty Kill xGA',
    shortDesc: 'Expected goals against per PK',
    whatItIs: 'Expected goals allowed per penalty kill opportunity. Measures how many quality chances the PK surrenders.',
    whyItMatters: 'Even if the PK% looks good, high xGA means they\'re relying on the goalie. Low xGA means strong structure and shot suppression.',
    howToRead: 'Lower is better. Below 0.36 = elite PK. 0.36-0.42 = good. 0.42-0.48 = average. Above 0.48 = struggling PK.',
    thresholds: {
      elite: 0.36,
      good: 0.42,
      average: 0.48,
      poor: 999,
    },
    higherIsBetter: false,
    format: 'decimal',
  },

  // GOALTENDING METRICS
  goalsSavedAboveExpected: {
    id: 'goalsSavedAboveExpected',
    name: 'Goals Saved Above Expected (GSAx)',
    shortDesc: 'Goalie performance vs expected',
    whatItIs: 'The number of goals a goalie has saved (or allowed) compared to what an average goalie would do facing the same shots.',
    whyItMatters: 'GSAx accounts for shot quality, unlike save percentage. It shows true goalie performance independent of team defense.',
    howToRead: 'Positive GSAx = saving more than expected (good goaltending). Above +5 = elite. 0 to +5 = above average. -5 to 0 = below average. Below -5 = poor goaltending.',
    thresholds: {
      elite: 5, // season total
      good: 2,
      average: -2,
      poor: -999,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  goalsAllowedAboveExpected: {
    id: 'goalsAllowedAboveExpected',
    name: 'Goals Saved Above Expected (GSAx)',
    shortDesc: 'Goalie performance vs expected',
    whatItIs: 'The number of goals a goalie has saved (or allowed) compared to what an average goalie would do facing the same shots.',
    whyItMatters: 'GSAx accounts for shot quality, unlike save percentage. It shows true goalie performance independent of team defense.',
    howToRead: 'Positive GSAx = saving more than expected (good goaltending). Above +5 = elite. 0 to +5 = above average. -5 to 0 = below average. Below -5 = poor goaltending.',
    thresholds: {
      elite: 5, // season total
      good: 2,
      average: -2,
      poor: -999,
    },
    higherIsBetter: true,
    format: 'decimal',
  },

  highDangerSavePct: {
    id: 'highDangerSavePct',
    name: 'High Danger Save %',
    shortDesc: 'Save % on premium chances',
    whatItIs: 'Save percentage specifically on high-danger scoring chances (slot shots, breakaways, etc.).',
    whyItMatters: 'Regular save % can be inflated by easy saves. HD Save % shows how a goalie performs when it matters most - on dangerous chances.',
    howToRead: 'Elite goalies exceed 84% on high-danger shots. Average is around 81%. Below 78% is a red flag.',
    thresholds: {
      elite: 84.0,
      good: 82.0,
      average: 80.0,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },

  reboundControl: {
    id: 'reboundControl',
    name: 'Rebound Control Rate',
    shortDesc: 'Defensive shot prevention metric',
    whatItIs: 'A composite metric measuring how well a team prevents rebounds and limits second-chance opportunities. Scaled inversely with shots against per game.',
    whyItMatters: 'Teams that control rebounds and limit follow-up chances reduce high-danger scoring opportunities.',
    howToRead: 'Above 12 = excellent defensive structure. 8-12 = good. 4-8 = average. Below 4 = struggling with rebound control.',
    thresholds: {
      elite: 12.0,
      good: 8.0,
      average: 4.0,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'number',
  },

  qualityStart: {
    id: 'qualityStart',
    name: 'Quality Start %',
    shortDesc: 'Goaltending consistency metric',
    whatItIs: 'Estimated percentage of games where a team\'s goaltending provides quality performance. Scaled based on save percentage and defensive support.',
    whyItMatters: 'Shows goaltending consistency. Teams with high quality start percentages get reliable goaltending night after night.',
    howToRead: 'Above 55% = elite consistency. 45-55% = solid. 35-45% = average. Below 35% = inconsistent goaltending.',
    thresholds: {
      elite: 55.0,
      good: 45.0,
      average: 35.0,
      poor: 0,
    },
    higherIsBetter: true,
    format: 'percentage',
  },
};

// Helper function to get rating based on league rank (1-32)
export function getMetricRating(
  metricId: string,
  value: number,
  leagueRank?: number
): 'elite' | 'good' | 'average' | 'poor' {
  const metric = ADVANCED_METRICS[metricId];
  if (!metric) return 'average';

  // If league rank is provided, use rank-based rating (relative to league)
  if (leagueRank !== undefined && leagueRank !== null) {
    if (leagueRank <= 8) return 'elite';    // Top 25% (1-8)
    if (leagueRank <= 16) return 'good';    // Top 50% (9-16)
    if (leagueRank <= 24) return 'average'; // Top 75% (17-24)
    return 'poor';                          // Bottom 25% (25-32)
  }

  // Fallback to threshold-based rating if no rank provided
  const { thresholds, higherIsBetter } = metric;

  if (higherIsBetter) {
    if (value >= thresholds.elite) return 'elite';
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.average) return 'average';
    return 'poor';
  } else {
    // For metrics where lower is better
    if (value <= thresholds.elite) return 'elite';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.average) return 'average';
    return 'poor';
  }
}

// Helper function to get color for rating
export function getRatingColor(rating: 'elite' | 'good' | 'average' | 'poor'): string {
  const colors = {
    elite: '#10b981', // green
    good: '#60a5fa', // blue
    average: '#f59e0b', // amber
    poor: '#ef4444', // red
  };
  return colors[rating];
}

// Helper function to format metric value
export function formatMetricValue(metric: AdvancedMetric, value: number): string {
  switch (metric.format) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'decimal':
      return value.toFixed(2);
    case 'number':
      return Math.round(value).toString();
    case 'ratio':
      return value.toFixed(3);
    default:
      return value.toString();
  }
}
