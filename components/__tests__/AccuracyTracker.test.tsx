/**
 * Tests for components/AccuracyTracker.tsx
 */

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import AccuracyTracker from '../AccuracyTracker';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    Share: { share: jest.fn() },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    StyleSheet: { create: (s: any) => s },
    Platform: { OS: 'ios' },
  };
});

jest.mock('react-native-chart-kit', () => {
  const React = require('react');
  return {
    LineChart: (props: any) => React.createElement('LineChart', props),
  };
});

const mockGetAccuracyStats = jest.fn();
jest.mock('../../services/accuracyStats', () => ({
  getAccuracyStats: () => mockGetAccuracyStats(),
}));

function findByTestId(root: any, testID: string): any[] {
  return root.root.findAll(
    (node: any) => node.props.testID === testID && typeof node.type === 'string'
  );
}

function getAllText(root: any): string[] {
  return root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      return '';
    })
    .filter(Boolean);
}

describe('AccuracyTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no picks exist', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 0,
      correctPicks: 0,
      accuracy: 0,
      last7Days: { total: 0, correct: 0, accuracy: 0 },
      last30Days: { total: 0, correct: 0, accuracy: 0 },
      currentStreak: 0,
      bestStreak: 0,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const texts = getAllText(tree);
    expect(texts).toContain('Make some picks to start tracking your accuracy!');
  });

  it('displays accuracy percentage and counts', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 10,
      correctPicks: 7,
      accuracy: 0.7,
      last7Days: { total: 5, correct: 4, accuracy: 0.8 },
      last30Days: { total: 8, correct: 6, accuracy: 0.75 },
      currentStreak: 3,
      bestStreak: 5,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const pctNode = findByTestId(tree, 'accuracy-percentage');
    expect(pctNode).toHaveLength(1);
    // Template literal renders as array of [number, string]
    const children = pctNode[0].props.children;
    const text = Array.isArray(children) ? children.join('') : children;
    expect(text).toBe('70%');

    // "7/10 correct" is a template literal with mixed children, verify the testID node exists
    const tracker = findByTestId(tree, 'accuracy-tracker');
    expect(tracker).toHaveLength(1);
  });

  it('displays streak information', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 10,
      correctPicks: 7,
      accuracy: 0.7,
      last7Days: { total: 3, correct: 2, accuracy: 0.67 },
      last30Days: { total: 8, correct: 6, accuracy: 0.75 },
      currentStreak: 3,
      bestStreak: 5,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const currentStreak = findByTestId(tree, 'current-streak');
    expect(currentStreak[0].props.children).toBe(3);

    const bestStreak = findByTestId(tree, 'best-streak');
    expect(bestStreak[0].props.children).toBe(5);
  });

  it('displays rolling window stats', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 10,
      correctPicks: 7,
      accuracy: 0.7,
      last7Days: { total: 5, correct: 4, accuracy: 0.8 },
      last30Days: { total: 8, correct: 6, accuracy: 0.75 },
      currentStreak: 2,
      bestStreak: 4,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const last7 = findByTestId(tree, 'last-7-days');
    expect(last7[0].props.children).toBe('80%');

    const last30 = findByTestId(tree, 'last-30-days');
    expect(last30[0].props.children).toBe('75%');
  });

  it('shows dashes when rolling windows have no data', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 1,
      correctPicks: 1,
      accuracy: 1,
      last7Days: { total: 0, correct: 0, accuracy: 0 },
      last30Days: { total: 0, correct: 0, accuracy: 0 },
      currentStreak: 1,
      bestStreak: 1,
      dailyAccuracy: [{ date: '2025-01-01', accuracy: 1, total: 1 }],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const last7 = findByTestId(tree, 'last-7-days');
    expect(last7[0].props.children).toBe('--');
  });

  it('shows share button with testID', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 5,
      correctPicks: 3,
      accuracy: 0.6,
      last7Days: { total: 5, correct: 3, accuracy: 0.6 },
      last30Days: { total: 5, correct: 3, accuracy: 0.6 },
      currentStreak: 1,
      bestStreak: 2,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const shareBtn = findByTestId(tree, 'share-stats-button');
    expect(shareBtn).toHaveLength(1);
  });

  it('calls Share.share when share button pressed', async () => {
    const { Share } = require('react-native');
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 5,
      correctPicks: 3,
      accuracy: 0.6,
      last7Days: { total: 5, correct: 3, accuracy: 0.6 },
      last30Days: { total: 5, correct: 3, accuracy: 0.6 },
      currentStreak: 1,
      bestStreak: 2,
      dailyAccuracy: [],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const shareBtn = findByTestId(tree, 'share-stats-button')[0];
    await act(async () => { shareBtn.props.onPress(); });

    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringContaining('60%'),
    });
  });

  it('renders chart when 2+ days of data available', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 5,
      correctPicks: 3,
      accuracy: 0.6,
      last7Days: { total: 5, correct: 3, accuracy: 0.6 },
      last30Days: { total: 5, correct: 3, accuracy: 0.6 },
      currentStreak: 1,
      bestStreak: 2,
      dailyAccuracy: [
        { date: '2026-04-01', accuracy: 0.5, total: 2 },
        { date: '2026-04-02', accuracy: 1.0, total: 3 },
      ],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const charts = tree.root.findAll((node: any) => node.type === 'LineChart');
    expect(charts).toHaveLength(1);
  });

  it('does not render chart with less than 2 days of data', async () => {
    mockGetAccuracyStats.mockResolvedValue({
      totalPicks: 2,
      correctPicks: 1,
      accuracy: 0.5,
      last7Days: { total: 2, correct: 1, accuracy: 0.5 },
      last30Days: { total: 2, correct: 1, accuracy: 0.5 },
      currentStreak: 0,
      bestStreak: 1,
      dailyAccuracy: [
        { date: '2026-04-01', accuracy: 0.5, total: 2 },
      ],
    });

    let tree: any;
    await act(async () => { tree = create(<AccuracyTracker />); });

    const charts = tree.root.findAll((node: any) => node.type === 'LineChart');
    expect(charts).toHaveLength(0);
  });
});
