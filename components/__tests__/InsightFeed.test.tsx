import React from 'react';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: any) => s },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: any) => c },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// Mock useMemo to pass through
jest.spyOn(React, 'useMemo').mockImplementation((fn: any) => fn());

// Access inner component through React.memo wrapper
const InsightFeedDefault = require('../InsightFeed').default;
const InsightFeedInner = InsightFeedDefault.type || InsightFeedDefault;

const mockInsights = [
  { id: '1', text: 'Bruins are 5-1 in last 6 road games', teamAbbrev: 'BOS', category: 'streak', shareText: 'Bruins road warriors' },
  { id: '2', text: 'Rangers on a back-to-back', teamAbbrev: 'NYR', category: 'rest', shareText: 'Rangers B2B' },
  { id: '3', text: 'Oilers lead division by 4 pts', teamAbbrev: 'EDM', category: 'standings', shareText: 'Oilers on top' },
];

function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

describe('InsightFeed', () => {
  it('returns null when insights array is empty', () => {
    const tree = InsightFeedInner({ insights: [] });
    expect(tree).toBeNull();
  });

  it('renders "INTEL" header', () => {
    const tree = InsightFeedInner({ insights: mockInsights });
    expect(collectText(tree)).toContain("INTEL");
  });

  it('renders insight text', () => {
    const tree = InsightFeedInner({ insights: mockInsights });
    const joined = collectText(tree).join(' ');
    expect(joined).toContain('Bruins are 5-1 in last 6 road games');
    expect(joined).toContain('Rangers on a back-to-back');
  });

  it('limits display to 3 insights', () => {
    const four = [
      ...mockInsights,
      { id: '4', text: 'Fourth insight', teamAbbrev: 'TOR', category: 'h2h' as const, shareText: 'Fourth' },
    ];
    const tree = InsightFeedInner({ insights: four });
    const joined = collectText(tree).join(' ');
    expect(joined).not.toContain('Fourth insight');
  });

  it('has testID "insight-feed"', () => {
    const tree = InsightFeedInner({ insights: mockInsights });
    expect(tree?.props?.testID).toBe('insight-feed');
  });
});
