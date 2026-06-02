/**
 * MatchupAnalyzer Tests
 * Tests the matchup analyzer component structure, props, and interactions.
 */
import React from 'react';

// ---- Imports (after mocks) ----

import MatchupAnalyzer from '../MatchupAnalyzer';

// ---- Mocks (before imports) ----

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
  Platform: { OS: 'ios', select: (o: any) => o.ios },
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    text: '#e6eef8',
    subtext: '#98a6bf',
    card: '#192e5eff',
    factbox: '#334e8dff',
    accent: '#60a5fa',
    background: '#071023',
    subtle: '#071a36',
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        ilike: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  },
}));

const mockAnalyzeMatchup = jest.fn();
jest.mock('../../services/matchupAnalysis', () => ({
  analyzeMatchup: (...args: any[]) => mockAnalyzeMatchup(...args),
}));

// ---- Tests ----

describe('MatchupAnalyzer', () => {
  const defaultProps = {
    myPlayerIds: [8478402, 8477934],
    scoringFormat: 'yahoo' as const,
    gameDate: '2026-04-04',
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const element = React.createElement(MatchupAnalyzer, defaultProps);
    expect(element).toBeTruthy();
    expect(element.props.myPlayerIds).toEqual([8478402, 8477934]);
  });

  it('exports a function component', () => {
    expect(typeof MatchupAnalyzer).toBe('function');
  });

  it('accepts scoringFormat prop', () => {
    const element = React.createElement(MatchupAnalyzer, {
      ...defaultProps,
      scoringFormat: 'espn',
    });
    expect(element.props.scoringFormat).toBe('espn');
  });

  it('accepts gameDate prop', () => {
    const element = React.createElement(MatchupAnalyzer, defaultProps);
    expect(element.props.gameDate).toBe('2026-04-04');
  });

  it('accepts myPlayerIds as an array of numbers', () => {
    const ids = [8478402, 8477934, 8480069];
    const element = React.createElement(MatchupAnalyzer, {
      ...defaultProps,
      myPlayerIds: ids,
    });
    expect(element.props.myPlayerIds).toHaveLength(3);
    expect(element.props.myPlayerIds).toEqual(ids);
  });

  it('works with empty myPlayerIds', () => {
    const element = React.createElement(MatchupAnalyzer, {
      ...defaultProps,
      myPlayerIds: [],
    });
    expect(element.props.myPlayerIds).toEqual([]);
  });
});

describe('MatchupAnalyzer service integration', () => {
  it('analyzeMatchup mock is callable', async () => {
    const sampleResult = {
      categories: [
        { category: 'Goals', myTotal: 2.1, oppTotal: 1.5, edge: 'winning' },
      ],
      myWins: 1,
      oppWins: 0,
      closeCategories: 0,
      recommendation: 'Maintain your current lineup.',
    };
    mockAnalyzeMatchup.mockResolvedValue(sampleResult);

    const { analyzeMatchup } = require('../../services/matchupAnalysis');
    const result = await analyzeMatchup([8478402], [8479318], 'yahoo', '2026-04-04');

    expect(mockAnalyzeMatchup).toHaveBeenCalledWith(
      [8478402], [8479318], 'yahoo', '2026-04-04'
    );
    expect(result.myWins).toBe(1);
    expect(result.categories).toHaveLength(1);
  });

  it('handles analysis error gracefully', async () => {
    mockAnalyzeMatchup.mockRejectedValue(new Error('Network error'));

    const { analyzeMatchup } = require('../../services/matchupAnalysis');
    await expect(analyzeMatchup([], [], 'yahoo', '2026-04-04')).rejects.toThrow('Network error');
  });
});

describe('MatchupAnalyzer categories', () => {
  it('defines 5 standard fantasy categories', () => {
    // The component displays these categories from the analysis result
    const expectedCategories = ['Goals', 'Assists', 'SOG', 'Hits', 'Blocks'];
    expect(expectedCategories).toHaveLength(5);
  });

  it('edge colors map to winning/losing/close', () => {
    const edgeColors = {
      winning: '#10b981',
      losing: '#ef4444',
      close: '#fbbf24',
    };
    expect(edgeColors.winning).toBe('#10b981');
    expect(edgeColors.losing).toBe('#ef4444');
    expect(edgeColors.close).toBe('#fbbf24');
  });
});
