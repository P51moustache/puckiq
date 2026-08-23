jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    TextInput: (props: any) => React.createElement('TextInput', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Alert: { alert: jest.fn() },
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
    Platform: { OS: 'ios' },
  };
});

jest.mock('../../services/fantasyRoster', () => ({
  loadRoster: jest.fn().mockResolvedValue({
    players: [{ playerId: 1, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C' }],
  }),
}));

jest.mock('../../services/opponentRoster', () => ({
  loadOpponentRoster: jest.fn().mockResolvedValue([]),
  addOpponentPlayer: jest.fn(),
  removeOpponentPlayer: jest.fn(),
}));

jest.mock('../../services/nhlPlayerSearch', () => ({
  searchNhlPlayers: jest.fn().mockResolvedValue([]),
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import LeagueScreen from '../LeagueScreen';

function find(tree: any, testID: string) {
  return tree.root.findAll((n: any) => n.props.testID === testID && typeof n.type === 'string');
}

describe('LeagueScreen', () => {
  it('shows my team and Yahoo / invite placeholders', async () => {
    let tree: any;
    await act(async () => { tree = create(<LeagueScreen />); });
    expect(find(tree, 'league-screen')).toHaveLength(1);
    expect(find(tree, 'league-invite')).toHaveLength(1);
    expect(find(tree, 'league-attach-yahoo')).toHaveLength(1);
    expect(find(tree, 'league-mine-player')).toHaveLength(1);
    const texts = tree.root
      .findAll((n: any) => n.type === 'Text')
      .map((n: any) => n.props.children)
      .filter((t: unknown) => typeof t === 'string');
    expect(texts).toContain('Your team vs theirs');
    expect(texts).toContain('NOT A HOSTED LEAGUE');
    const subtitle = tree.root.findAll((n: any) => n.props.testID === 'page-header-subtitle')[0];
    expect(subtitle.props.numberOfLines).toBeUndefined();
  });
});
