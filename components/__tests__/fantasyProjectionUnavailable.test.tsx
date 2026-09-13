import React from 'react';
import { act, create } from 'react-test-renderer';
import StartSitCard from '../StartSitCard';
import FantasyProjectionRow from '../FantasyProjectionRow';
import type { PlayerProjection } from '../../types/fantasy';

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    StyleSheet: { create: (styles: any) => styles },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual('react');
  return { Ionicons: (props: any) => React.createElement('Ionicons', props) };
});

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react');
  const View = ({ children, ...props }: any) => React.createElement('View', props, children);
  return {
    __esModule: true,
    default: { View },
    FadeInDown: { delay: () => ({ duration: () => ({ springify: () => ({}) }) }) },
  };
});

const projection: PlayerProjection = {
  playerId: 8478402,
  playerName: 'Connor McDavid',
  teamAbbrev: 'EDM',
  position: 'C',
  fantasyPoints: 8.5,
  floor: 3,
  ceiling: 15,
  predGoals: 0.6,
  predAssists: 1.2,
  predSog: 4.1,
  predHits: 0.5,
  predBlocks: 0.3,
  recommendation: null,
  confidence: null,
  reason: null,
  gameId: 2025020100,
  opponentAbbrev: 'CGY',
  isHome: true,
};

function textContent(tree: any): string {
  return tree.root.findAll((node: any) => node.type === 'Text')
    .map((node: any) => node.props.children)
    .filter((value: unknown): value is string => typeof value === 'string')
    .join(' ');
}

function render(element: React.ReactElement) {
  let tree: any;
  act(() => { tree = create(element); });
  return tree;
}

describe('fantasy projection recommendation availability', () => {
  it('renders a neutral forecast-only state in StartSitCard', () => {
    const tree = render(<StartSitCard projection={projection} />);
    const text = textContent(tree);

    expect(text).toContain('Forecast only / recommendation unavailable');
    expect(text).not.toContain('FLEX');
    expect(text).not.toContain('SIT');
    expect(text).toContain('8.5');
  });

  it('renders a neutral forecast-only state in FantasyProjectionRow', () => {
    const tree = render(<FantasyProjectionRow projection={projection} />);
    const text = textContent(tree);

    expect(text).toContain('Forecast only / recommendation unavailable');
    expect(text).not.toContain('FLEX');
    expect(text).not.toContain('SIT');
    expect(text).toContain('8.5');
  });
});
