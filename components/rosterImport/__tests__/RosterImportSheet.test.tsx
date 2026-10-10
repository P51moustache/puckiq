jest.mock('react-native', () => {
  const React = require('react');
  const passthrough = (name: string) => {
    const Mock = ({ children, ...props }: any) => React.createElement(name, props, children);
    Mock.displayName = name;
    return Mock;
  };
  return {
    View: passthrough('View'),
    Text: passthrough('Text'),
    ScrollView: passthrough('ScrollView'),
    Modal: passthrough('Modal'),
    KeyboardAvoidingView: passthrough('KeyboardAvoidingView'),
    TextInput: passthrough('TextInput'),
    ActivityIndicator: passthrough('ActivityIndicator'),
    Pressable: ({ children, style, ...props }: any) =>
      React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (o: any) => o.ios },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: any) => React.createElement('Ionicons', props) };
});
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../coach/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
const mockTrack = jest.fn();
jest.mock('../../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
const mockUpdateTeam = jest.fn();
let mockTeam: any = null;
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, updateTeam: mockUpdateTeam }) }));
let mockFlow: any = null;
jest.mock('../../../hooks/useRosterImport', () => ({ useRosterImport: () => mockFlow }));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import { RosterImportSheet } from '../RosterImportSheet';
import { createTeam } from '../../../services/teams';
import { startReview } from '../../../services/rosterImport/review';
import type { RosterPlayer } from '../../../services/nhl/rosters';

const MCDAVID: RosterPlayer = { playerId: 8478402, firstName: 'Connor', lastName: 'McDavid', team: 'EDM', position: 'C' };
const DRAISAITL: RosterPlayer = { playerId: 8477934, firstName: 'Leon', lastName: 'Draisaitl', team: 'EDM', position: 'C' };
const JACK: RosterPlayer = { playerId: 8481559, firstName: 'Jack', lastName: 'Hughes', team: 'NJD', position: 'C' };
const LUKE: RosterPlayer = { playerId: 8482701, firstName: 'Luke', lastName: 'Hughes', team: 'NJD', position: 'D' };

const flow = (overrides: any = {}) => ({
  stage: { kind: 'choose' },
  canScan: true,
  scan: jest.fn(),
  paste: jest.fn(),
  toggle: jest.fn(),
  pick: jest.fn(),
  restart: jest.fn(),
  selection: [],
  ...overrides,
});

const mounted: any[] = [];
function render(onClose = jest.fn()) {
  let tree: any;
  act(() => { tree = create(<RosterImportSheet visible source="onboarding" onClose={onClose} />); });
  mounted.push(tree);
  return tree;
}
afterEach(() => { while (mounted.length) act(() => mounted.pop().unmount()); });

const byTestId = (tree: any, id: string) => tree.root.findAll((n: any) => n.props.testID === id && typeof n.type === 'string');
const allText = (tree: any) => tree.root.findAll((n: any) => n.type === 'Text')
  .map((n: any) => [].concat(n.props.children).filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
  .join(' | ');
const press = (tree: any, id: string) => act(() => { byTestId(tree, id)[0].props.onPress(); });

describe('RosterImportSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeam = createTeam({ name: 'Beauties', players: [] });
    mockFlow = flow();
  });

  it('opens on the screenshot pitch and tracks where it came from', () => {
    const tree = render();
    expect(allText(tree)).toContain('YOUR WHOLE ROSTER, IN SECONDS');
    expect(mockTrack).toHaveBeenCalledWith('roster_import_open', { source: 'onboarding' });
    press(tree, 'roster-import-scan');
    expect(mockFlow.scan).toHaveBeenCalled();
  });

  it('offers only pasting on a build that can’t read screenshots', () => {
    mockFlow = flow({ canScan: false });
    const tree = render();
    expect(byTestId(tree, 'roster-import-scan')).toHaveLength(0);
    expect(byTestId(tree, 'roster-import-paste')[0].props.accessibilityLabel).toBe('Paste or type names');
  });

  it('pastes names and looks them up', () => {
    const tree = render();
    press(tree, 'roster-import-paste');
    expect(byTestId(tree, 'roster-import-find')[0].props.disabled).toBe(true);
    act(() => { byTestId(tree, 'roster-import-text')[0].props.onChangeText('McDavid, Draisaitl'); });
    expect(byTestId(tree, 'roster-import-find')[0].props.disabled).toBeFalsy();
    press(tree, 'roster-import-find');
    expect(mockFlow.paste).toHaveBeenCalledWith('McDavid, Draisaitl');
  });

  it('reviews what it found and adds the selection to my team', () => {
    const review = startReview({
      matched: [{ player: MCDAVID, confidence: 'exact', source: 'Connor McDavid' }, { player: DRAISAITL, confidence: 'likely', source: 'L. Draisaitl' }],
      ambiguous: [{ source: 'Hughes NJ', options: [JACK, LUKE] }],
      unmatched: ['Bobby Unknown'],
      leftovers: ['Bobby Unknown'],
    }, new Set());
    mockFlow = flow({ stage: { kind: 'review', method: 'screenshot', review }, selection: [MCDAVID, DRAISAITL] });
    const onClose = jest.fn();
    const tree = render(onClose);
    const text = allText(tree);
    expect(text).toContain('FOUND 3');
    expect(text).toContain('Which Hughes?');
    expect(text).toContain('Couldn’t match Bobby Unknown');
    press(tree, 'import-option-8482701');
    expect(mockFlow.pick).toHaveBeenCalledWith(0, LUKE.playerId);
    press(tree, 'import-player-8477934');
    expect(mockFlow.toggle).toHaveBeenCalledWith(DRAISAITL.playerId);

    press(tree, 'roster-import-add');
    const update = mockUpdateTeam.mock.calls[0][0];
    expect(update(mockTeam).players.map((p: any) => p.playerName)).toEqual(['Connor McDavid', 'Leon Draisaitl']);
    expect(mockTrack).toHaveBeenCalledWith('roster_import_add', { source: 'onboarding', method: 'screenshot', added: 2 });
    expect(onClose).toHaveBeenCalled();
  });

  it('explains what to screenshot when it finds nobody', () => {
    mockFlow = flow({ stage: { kind: 'review', method: 'screenshot', review: startReview({ matched: [], ambiguous: [], unmatched: [], leftovers: [] }, new Set()) } });
    const tree = render();
    expect(byTestId(tree, 'roster-import-nothing')).toHaveLength(1);
    expect(allText(tree)).toContain('roster screen');
    expect(byTestId(tree, 'roster-import-add')[0].props.disabled).toBe(true);
  });

  it('shows the error and starts over on retry', () => {
    mockFlow = flow({ stage: { kind: 'error', message: 'Couldn’t load the NHL rosters.' } });
    const tree = render();
    expect(allText(tree)).toContain('Couldn’t load the NHL rosters.');
    press(tree, 'roster-import-retry');
    expect(mockFlow.restart).toHaveBeenCalled();
  });
});
