jest.mock('react-native', () => {
  const React = require('react');
  const base = require('../../week/__tests__/support/mocks').reactNativeMock();
  return {
    ...base,
    TextInput: (props: any) => React.createElement('TextInput', props),
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent }: any) =>
      React.createElement('FlatList', null, data.length > 0
        ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item, index })))
        : ListEmptyComponent ?? null),
  };
});
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return { __esModule: true, default: { View: ({ children, entering: _e, ...props }: any) => React.createElement('AnimatedView', props, children) }, FadeIn: { duration: () => undefined } };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../coach/PlayerAvatar', () => ({ PlayerAvatar: () => null, PlayerName: () => null, splitName: (name: string) => ({ first: '', last: name.split(' ').slice(1).join(' ') }) }));
jest.mock('../../coach/SegmentedControl', () => ({
  SegmentedControl: ({ options, onChange, testID }: any) => {
    const React = require('react');
    return React.createElement('View', null, options.map((option: any) =>
      React.createElement('Pressable', { key: option.value, testID: `${testID}-${option.value}`, onPress: () => onChange(option.value) })));
  },
}));
jest.mock('../../rosterImport/RosterImportSheet', () => ({ RosterImportSheet: () => null }));
jest.mock('../../../services/nhlPlayerSearch', () => ({ searchNhlPlayers: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, updateTeam: mockUpdateTeam }) }));

import React from 'react';
import { press as pressNode, render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId, oneByTestId } from '../../week/__tests__/support/tree';
import { RosterStep } from '../RosterStep';
import { SAMPLE_PLAYERS } from '../../../constants/sampleTeam';

const mockTrack = jest.fn();
const mockUpdateTeam = jest.fn();
let mockTeam: any;
let mockPicks: any;
const mcdavid = { playerId: 8478402, name: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', active: true };
const makar = { playerId: 8480069, name: 'Cale Makar', teamAbbrev: 'COL', position: 'D', active: true };
const groups = { F: [mcdavid], D: [makar], G: [] };
const press = (root: any, id: string) => pressNode(oneByTestId(root, id));

afterEach(unmountAll);
beforeEach(() => {
  jest.clearAllMocks();
  mockTeam = { id: 't1', players: [] };
  mockPicks = { groups, loading: false, error: null, retry: jest.fn() };
});

describe('RosterStep', () => {
  it('leads with screenshot import, then the most-owned forwards as a grid', () => {
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    expect(byTestId(root, 'onboarding-import')).toHaveLength(1);
    expect(byTestId(root, 'quick-pick-8478402')).toHaveLength(1);
    expect(byTestId(root, 'quick-pick-8480069')).toHaveLength(0);
    press(root, 'quick-pick-group-D');
    expect(byTestId(root, 'quick-pick-8480069')).toHaveLength(1);
  });

  it('adds a tapped player and checks the players already on the roster', () => {
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    press(root, 'quick-pick-8478402');
    expect(mockUpdateTeam).toHaveBeenCalledTimes(1);
    expect(mockUpdateTeam.mock.calls[0][0]({ players: [] }).players.map((p: any) => p.playerId)).toEqual([8478402]);
    expect(mockTrack).toHaveBeenCalledWith('onboarding_quick_pick', { action: 'add', position: 'C' });

    unmountAll();
    mockTeam = { id: 't1', players: [{ playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' }] };
    const added = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    expect(oneByTestId(added, 'quick-pick-8478402').props.accessibilityState).toEqual({ checked: true });
    expect(allText(added)).toContain('1 added.');
  });

  it('needs a player or the sample team to move on, with no skip', () => {
    const onDone = jest.fn();
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={onDone} />);
    expect(oneByTestId(root, 'onboarding-roster-continue').props.disabled).toBe(true);
    expect(allText(root)).not.toContain('add players later');
    press(root, 'onboarding-sample-team');
    expect(onDone).toHaveBeenCalledWith('sample', SAMPLE_PLAYERS.length);
  });

  it('continues with the roster count once players are added', () => {
    mockTeam = { id: 't1', players: [{ playerId: 1, playerName: 'A B', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' }] };
    const onDone = jest.fn();
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={onDone} />);
    expect(byTestId(root, 'onboarding-sample-team')).toHaveLength(0);
    press(root, 'onboarding-roster-continue');
    expect(onDone).toHaveBeenCalledWith('continue', 1);
  });

  it('says a partial roster is partial and shows how far along it is', () => {
    mockTeam = { id: 't1', platform: 'yahoo', players: [1, 2].map((playerId) => ({ playerId, playerName: 'A B', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' })) };
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    expect(byTestId(root, 'onboarding-import-card')).toHaveLength(1);
    expect(allText(root)).toContain('Screenshot your Yahoo roster to add everyone.');
    expect(allText(root)).toContain('2 of ~16 players');
    expect(allText(root)).toContain('Continue with 2 for now');
    expect(allText(root)).toContain('Add the rest anytime.');
  });

  it('drops the progress line once the roster can fill a lineup', () => {
    mockTeam = { id: 't1', players: Array.from({ length: 16 }, (_, index) => ({ playerId: index + 1, playerName: 'A B', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' })) };
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    expect(byTestId(root, 'onboarding-roster-progress')).toHaveLength(0);
    expect(byTestId(root, 'onboarding-import-card')).toHaveLength(0);
    expect(allText(root)).toContain('Continue with 16');
    expect(allText(root)).not.toContain('for now');
  });

  it('keeps search working when popular players fail to load', () => {
    mockPicks = { groups: null, loading: false, error: 'offline', retry: jest.fn() };
    const root = render(<RosterStep picks={mockPicks} bottomInset={0} onDone={jest.fn()} />);
    expect(allText(root)).toContain('Search still works');
    expect(byTestId(root, 'onboarding-search')).toHaveLength(1);
  });
});
