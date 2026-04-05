// Enable React act() environment for async state updates
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    TextInput: (props: any) => React.createElement('TextInput', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    StyleSheet: { create: (s: any) => s },
  };
});

// Mock leaderboard service
const mockGetTopPredictors = jest.fn();
const mockSetDisplayName = jest.fn();

jest.mock('../../services/leaderboard', () => ({
  getTopPredictors: (...args: any[]) => mockGetTopPredictors(...args),
  setDisplayName: (...args: any[]) => mockSetDisplayName(...args),
}));

// Mock auth context
const mockAuthContext = {
  session: null,
  user: null as any,
  initializing: false,
  error: null,
  isDeveloper: false,
  hasFullAccess: false,
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
};

jest.mock('../auth/AuthProvider', () => ({
  useAuthContext: () => mockAuthContext,
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import Leaderboard from '../Leaderboard';

// Helpers
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
      if (Array.isArray(children)) return children.filter((c: any) => typeof c === 'string').join('');
      return '';
    })
    .filter(Boolean);
}

describe('Leaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.user = null;
    mockGetTopPredictors.mockResolvedValue([]);
    mockSetDisplayName.mockResolvedValue(undefined);
  });

  it('renders the title', async () => {
    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });
    expect(getAllText(tree)).toContain('Top Predictors');
  });

  it('shows period toggle buttons', async () => {
    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });
    expect(findByTestId(tree, 'period-week')).toHaveLength(1);
    expect(findByTestId(tree, 'period-season')).toHaveLength(1);
  });

  it('shows loading indicator initially', async () => {
    // Make getTopPredictors hang
    mockGetTopPredictors.mockReturnValue(new Promise(() => {}));

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });
    expect(findByTestId(tree, 'leaderboard-loading')).toHaveLength(1);
  });

  it('shows empty state when no entries', async () => {
    mockGetTopPredictors.mockResolvedValue([]);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });
    expect(findByTestId(tree, 'leaderboard-empty')).toHaveLength(1);
    expect(getAllText(tree)).toContain('Be the first on the leaderboard!');
  });

  it('renders leaderboard entries', async () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', totalPicks: 50, correctPicks: 30, accuracy: 0.6, streak: 7, rank: 1 },
      { userId: 'u2', displayName: 'Bob', totalPicks: 40, correctPicks: 20, accuracy: 0.5, streak: 2, rank: 2 },
    ];
    mockGetTopPredictors.mockResolvedValue(entries);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    expect(findByTestId(tree, 'leaderboard-list')).toHaveLength(1);
    expect(findByTestId(tree, 'leaderboard-row-1')).toHaveLength(1);
    expect(findByTestId(tree, 'leaderboard-row-2')).toHaveLength(1);
    const texts = getAllText(tree);
    expect(texts).toContain('Alice');
    expect(texts).toContain('Bob');
    expect(texts).toContain('60.0%');
    expect(texts).toContain('50.0%');
  });

  it('shows fire emoji for streak >= 5', async () => {
    const entries = [
      { userId: 'u1', displayName: 'Streaker', totalPicks: 20, correctPicks: 15, accuracy: 0.75, streak: 6, rank: 1 },
      { userId: 'u2', displayName: 'NoStreak', totalPicks: 20, correctPicks: 10, accuracy: 0.5, streak: 3, rank: 2 },
    ];
    mockGetTopPredictors.mockResolvedValue(entries);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    // Streaker (streak=6) should have a streak text node rendered
    // The streak text has two children: emoji + number, so look for the raw node
    const allNodes = tree.root.findAll((node: any) => node.type === 'Text');
    const streakNodes = allNodes.filter((node: any) => {
      const children = node.props.children;
      if (Array.isArray(children)) return children.some((c: any) => c === 6);
      return children === 6;
    });
    expect(streakNodes.length).toBeGreaterThan(0);
  });

  it('switches period when toggle pressed', async () => {
    mockGetTopPredictors.mockResolvedValue([]);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    // Initially fetches with 'week'
    expect(mockGetTopPredictors).toHaveBeenCalledWith('week');

    // Switch to season
    await act(async () => {
      findByTestId(tree, 'period-season')[0].props.onPress();
    });

    expect(mockGetTopPredictors).toHaveBeenCalledWith('season');
  });

  it('highlights current user row', async () => {
    mockAuthContext.user = { id: 'u1', email: 'test@test.com' };
    const entries = [
      { userId: 'u1', displayName: 'Me', totalPicks: 30, correctPicks: 15, accuracy: 0.5, streak: 0, rank: 1 },
    ];
    mockGetTopPredictors.mockResolvedValue(entries);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    const row = findByTestId(tree, 'leaderboard-row-1')[0];
    // Current user row should have the highlighted style (borderColor = accent)
    expect(row.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderColor: expect.any(String) })])
    );
  });

  it('shows name prompt for logged-in user not on leaderboard', async () => {
    mockAuthContext.user = { id: 'u-new', email: 'new@test.com' };
    const entries = [
      { userId: 'u1', displayName: 'Alice', totalPicks: 50, correctPicks: 30, accuracy: 0.6, streak: 0, rank: 1 },
    ];
    mockGetTopPredictors.mockResolvedValue(entries);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    expect(findByTestId(tree, 'name-prompt')).toHaveLength(1);
    expect(getAllText(tree)).toContain('Set a display name to join the leaderboard');
  });

  it('does not show name prompt when user is on leaderboard', async () => {
    mockAuthContext.user = { id: 'u1', email: 'alice@test.com' };
    const entries = [
      { userId: 'u1', displayName: 'Alice', totalPicks: 50, correctPicks: 30, accuracy: 0.6, streak: 0, rank: 1 },
    ];
    mockGetTopPredictors.mockResolvedValue(entries);

    let tree: any;
    await act(async () => { tree = create(<Leaderboard />); });

    expect(findByTestId(tree, 'name-prompt')).toHaveLength(0);
  });
});
