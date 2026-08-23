jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    Modal: () => null,
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Alert: { alert: jest.fn() },
    StyleSheet: { create: (s: any) => s },
  };
});

const mockSub = { isPremium: false, loading: false, refresh: jest.fn() };
jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockSub,
}));

jest.mock('../ProPaywall', () => () => null);

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import CoachSuggestionsCard from '../CoachSuggestionsCard';
import type { TonightPlayerStatus } from '../../types/fantasy';

function status(overrides: Partial<TonightPlayerStatus>): TonightPlayerStatus {
  return {
    playerId: 1,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    opponentAbbrev: 'CGY',
    isHome: true,
    gameId: 1,
    startTimeUTC: null,
    gameState: 'FUT',
    injurySignal: 'ok',
    injuryNote: null,
    confidence: 'unknown',
    recommendation: 'START',
    reason: "In tonight's lineup",
    ...overrides,
  };
}

function render(statuses: TonightPlayerStatus[]) {
  let tree: any;
  act(() => { tree = create(<CoachSuggestionsCard statuses={statuses} />); });
  return tree;
}

describe('CoachSuggestionsCard', () => {
  it('shows one sample for free users and a Pro unlock', () => {
    mockSub.isPremium = false;
    const tree = render([
      status({ playerId: 1, playerName: 'Hurt', injurySignal: 'out', recommendation: 'SIT' }),
      status({ playerId: 2, playerName: 'Connor McDavid', recommendation: 'START' }),
    ]);
    const byId = (id: string) => tree.root.findAll((n: any) => n.props.testID === id && typeof n.type === 'string');
    expect(byId('coach-suggestions')).toHaveLength(1);
    expect(byId('coach-drop')).toHaveLength(1);
    expect(byId('coach-unlock')).toHaveLength(1);
    expect(byId('coach-host-note')).toHaveLength(1);
  });

  it('shows the full coach list for Pro', () => {
    mockSub.isPremium = true;
    const tree = render([
      status({ playerId: 1, playerName: 'Hurt', injurySignal: 'out', recommendation: 'SIT' }),
      status({ playerId: 2, playerName: 'Connor McDavid', recommendation: 'START' }),
    ]);
    const byId = (id: string) => tree.root.findAll((n: any) => n.props.testID === id && typeof n.type === 'string');
    expect(byId('coach-drop')).toHaveLength(1);
    expect(byId('coach-start')).toHaveLength(1);
    expect(byId('coach-unlock')).toHaveLength(0);
  });
});
