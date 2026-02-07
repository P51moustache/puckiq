/**
 * Glossary of PuckIQ terminology.
 * Used by tooltip/info components to explain app-specific terms.
 */

export interface GlossaryEntry {
  term: string;
  explanation: string;
  category: 'confidence' | 'factor' | 'edge' | 'stat' | 'category';
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Confidence badges
  lock: {
    term: 'LOCK',
    explanation: 'Our strongest call of the night. The model sees a clear edge for one team across multiple factors.',
    category: 'confidence',
  },
  strong: {
    term: 'STRONG',
    explanation: 'One team has a clear advantage. Not a slam dunk, but the numbers favor them convincingly.',
    category: 'confidence',
  },
  lean: {
    term: 'LEAN',
    explanation: 'A slight edge detected. The model sees a small but real difference between the two teams.',
    category: 'confidence',
  },
  tossup: {
    term: 'TOSS-UP',
    explanation: 'Too close to call. Neither team has a meaningful edge tonight.',
    category: 'confidence',
  },

  // Factor chips
  h2h: {
    term: 'H2H',
    explanation: 'Head-to-Head. This team has your opponent\'s number this season based on their series record.',
    category: 'factor',
  },
  mtm: {
    term: 'MTM',
    explanation: 'Momentum. How hot or cold a team is based on their last 10 games. Winning streaks matter.',
    category: 'factor',
  },
  rest: {
    term: 'REST',
    explanation: 'Rest advantage. More days off means fresher legs. Teams on back-to-backs are at a disadvantage.',
    category: 'factor',
  },
  b2b: {
    term: 'B2B',
    explanation: 'Back-to-Back. This team is playing their second game in two days. Expect fatigue.',
    category: 'factor',
  },

  // Edge/analytics terms
  topEdge: {
    term: 'TOP EDGE',
    explanation: 'The game tonight where our model sees the biggest gap between the two teams. This is the headline matchup.',
    category: 'edge',
  },
  confidence: {
    term: 'Confidence %',
    explanation: 'How strongly the model favors one team. Higher means a bigger edge. 100% would mean a sure thing (which never happens in hockey).',
    category: 'edge',
  },
  winProb: {
    term: 'Win Probability',
    explanation: 'Each team\'s estimated chance of winning based on multiple factors like form, matchups, and rest.',
    category: 'edge',
  },
  xg: {
    term: 'xG',
    explanation: 'Expected Goals. Measures shot quality, not just quantity. A team with higher xG is creating better scoring chances.',
    category: 'stat',
  },

  // Stat of the Night categories
  streak: {
    term: 'STREAK',
    explanation: 'A team on a hot or cold run. Win streaks and losing streaks both tell a story about momentum.',
    category: 'category',
  },
  edge: {
    term: 'EDGE',
    explanation: 'A statistical advantage one team holds. Could be special teams, possession, or shot quality.',
    category: 'category',
  },
  momentum: {
    term: 'MOMENTUM',
    explanation: 'Whether a team is trending up or down based on recent results and performance metrics.',
    category: 'category',
  },
  player: {
    term: 'PLAYER',
    explanation: 'A standout individual performance. One player can swing a game.',
    category: 'category',
  },
  standings: {
    term: 'STANDINGS',
    explanation: 'Where teams sit in the divisional or conference race. Playoff implications add urgency.',
    category: 'category',
  },
};

/**
 * Look up a glossary entry by key (case-insensitive, handles common aliases).
 */
export function getGlossaryEntry(key: string): GlossaryEntry | null {
  // Try exact key first (handles camelCase keys like 'topEdge', 'winProb')
  if (GLOSSARY[key]) return GLOSSARY[key];

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (GLOSSARY[normalized]) return GLOSSARY[normalized];

  // Aliases: normalized form -> actual GLOSSARY key
  const aliases: Record<string, string> = {
    headtohead: 'h2h',
    backtoback: 'b2b',
    winprobability: 'winProb',
    expectedgoals: 'xg',
    tossup: 'tossup',
    topedge: 'topEdge',
    winprob: 'winProb',
  };

  const aliasKey = aliases[normalized];
  if (aliasKey && GLOSSARY[aliasKey]) return GLOSSARY[aliasKey];

  return null;
}
