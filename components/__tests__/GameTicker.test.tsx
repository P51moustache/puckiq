import React from 'react';

import GameTicker from '../GameTicker';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  FlatList: 'FlatList',
  StyleSheet: { create: (s: any) => s },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: any) => c },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  FadeInRight: { duration: () => ({ delay: () => ({}) }) },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedProps: () => ({}),
  useDerivedValue: (fn: () => any) => ({ value: fn() }),
  withTiming: (v: any) => v,
  Easing: { out: (fn: any) => fn, cubic: (v: any) => v },
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const mockGames = [
  { id: 101, awayTeam: { abbrev: 'BOS' }, homeTeam: { abbrev: 'NYR' } },
  { id: 102, awayTeam: { abbrev: 'EDM' }, homeTeam: { abbrev: 'VAN' } },
];
const mockPredictions = new Map([
  ['101', { homeWinProb: 60, awayWinProb: 40 }],
  ['102', { homeWinProb: 45, awayWinProb: 55 }],
]);
const mockH2hMap = new Map();

function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

function findByType(node: any, typeName: string): any[] {
  const results: any[] = [];
  if (!node) return results;
  if (Array.isArray(node)) { node.forEach((n: any) => results.push(...findByType(n, typeName))); return results; }
  if (node.type === typeName) results.push(node);
  if (node.props?.children) results.push(...findByType(node.props.children, typeName));
  return results;
}

describe('GameTicker', () => {
  const onGamePress = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it('returns null when games array is empty', () => {
    const tree = GameTicker({ games: [], predictions: mockPredictions, h2hMap: mockH2hMap, onGamePress });
    expect(tree).toBeNull();
  });

  it('renders "TONIGHT\'S GAMES" header', () => {
    const tree = GameTicker({ games: mockGames, predictions: mockPredictions, h2hMap: mockH2hMap, onGamePress });
    expect(collectText(tree)).toContain("TONIGHT'S GAMES");
  });

  it('renders team abbreviations in capsules', () => {
    const tree = GameTicker({ games: mockGames, predictions: mockPredictions, h2hMap: mockH2hMap, onGamePress });
    // FlatList is a string mock, so renderItem is in props.renderItem
    const flatList = findByType(tree, 'FlatList')[0];
    const rendered = mockGames.map((item: any, index: number) => flatList.props.renderItem({ item, index }));
    const text = rendered.flatMap(collectText).join(' ');
    expect(text).toContain('BOS');
    expect(text).toContain('NYR');
    expect(text).toContain('EDM');
    expect(text).toContain('VAN');
  });

  it('calls onGamePress when capsule tapped', () => {
    const tree = GameTicker({ games: mockGames, predictions: mockPredictions, h2hMap: mockH2hMap, onGamePress });
    const flatList = findByType(tree, 'FlatList')[0];
    const rendered = flatList.props.renderItem({ item: mockGames[0], index: 0 });
    const pressables = findByType(rendered, 'Pressable');
    pressables[0]?.props?.onPress?.();
    expect(onGamePress).toHaveBeenCalledWith(mockGames[0]);
  });
});
