jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, onPress, ...props }: any) =>
      React.createElement('TouchableOpacity', { ...props, onPress }, children),
    StyleSheet: {
      create: (s: any) => s,
      flatten: (style: any) => {
        if (Array.isArray(style)) {
          return Object.assign({}, ...style.filter(Boolean));
        }
        return style || {};
      },
    },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
      Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
      createAnimatedComponent: (comp: any) => comp,
    },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MatchupEdgeModule from '../MatchupEdgeModule';

const mockMatchups = [
  {
    id: 1,
    playerName: 'Connor McDavid',
    team: 'EDM',
    opponent: 'CGY',
    edgeRating: 9,
    projectedPoints: 5.2,
    reasons: ['CGY allows 4th-most goals to centers', 'Power play time expected'],
  },
  {
    id: 2,
    playerName: 'Nathan MacKinnon',
    team: 'COL',
    opponent: 'ARI',
    edgeRating: 4,
    projectedPoints: 3.1,
    reasons: ['ARI middle-of-pack defensively'],
  },
  {
    id: 3,
    playerName: 'Auston Matthews',
    team: 'TOR',
    opponent: 'MTL',
    edgeRating: 7,
    projectedPoints: 4.5,
    reasons: ['MTL allows most goals to centers', 'Home ice advantage'],
  },
];

describe('MatchupEdgeModule', () => {
  it('renders matchup cards with edge rating', () => {
    const { getByText } = render(<MatchupEdgeModule matchups={mockMatchups} />);
    expect(getByText('Connor McDavid')).toBeTruthy();
    expect(getByText('9')).toBeTruthy();
    expect(getByText('5.2')).toBeTruthy();
    expect(getByText('Matchup Edge')).toBeTruthy();
  });

  it('shows higher intensity color for better matchups', () => {
    const { getByTestId } = render(<MatchupEdgeModule matchups={mockMatchups} />);
    const highEdgeBadge = getByTestId('edge-badge-1');
    const lowEdgeBadge = getByTestId('edge-badge-2');

    // High edge (9) should have vivid green background
    const highStyle = Array.isArray(highEdgeBadge.props.style)
      ? Object.assign({}, ...highEdgeBadge.props.style.filter(Boolean))
      : highEdgeBadge.props.style;
    const lowStyle = Array.isArray(lowEdgeBadge.props.style)
      ? Object.assign({}, ...lowEdgeBadge.props.style.filter(Boolean))
      : lowEdgeBadge.props.style;

    // High rating should have higher opacity/more vivid color than low rating
    expect(highStyle.backgroundColor).not.toEqual(lowStyle.backgroundColor);
  });

  it('expands inline bullets on tap', () => {
    const { getByTestId, queryByText } = render(<MatchupEdgeModule matchups={mockMatchups} />);

    // Reasons should not be visible initially
    expect(queryByText('CGY allows 4th-most goals to centers')).toBeNull();

    // Tap the card to expand
    fireEvent.press(getByTestId('matchup-card-1'));

    // Reasons should now be visible
    expect(queryByText('CGY allows 4th-most goals to centers')).toBeTruthy();
    expect(queryByText('Power play time expected')).toBeTruthy();
  });

  it('renders empty state when no matchups', () => {
    const { getByText } = render(<MatchupEdgeModule matchups={[]} />);
    expect(getByText('No matchup edges tonight')).toBeTruthy();
  });

  it('applies green-tinted background for high-edge matchups', () => {
    const { getByTestId } = render(<MatchupEdgeModule matchups={mockMatchups} />);
    const highCard = getByTestId('matchup-card-1'); // edgeRating 9
    const lowCard = getByTestId('matchup-card-2'); // edgeRating 4

    const highStyle = Array.isArray(highCard.props.style)
      ? Object.assign({}, ...highCard.props.style.filter(Boolean))
      : highCard.props.style;
    const lowStyle = Array.isArray(lowCard.props.style)
      ? Object.assign({}, ...lowCard.props.style.filter(Boolean))
      : lowCard.props.style;

    // High edge card should have green tint, low edge should not
    expect(highStyle.backgroundColor).not.toEqual(lowStyle.backgroundColor);
  });

  it('limits display to 5 matchups', () => {
    const sixMatchups = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      playerName: `Player ${i + 1}`,
      team: 'TST',
      opponent: 'OPP',
      edgeRating: 5,
      projectedPoints: 3.0,
      reasons: ['Reason'],
    }));
    const { queryByText } = render(<MatchupEdgeModule matchups={sixMatchups} />);
    expect(queryByText('Player 5')).toBeTruthy();
    expect(queryByText('Player 6')).toBeNull();
  });

  it('displays opponent matchup info', () => {
    const { getByText } = render(<MatchupEdgeModule matchups={mockMatchups} />);
    expect(getByText('vs CGY')).toBeTruthy();
    expect(getByText('vs ARI')).toBeTruthy();
  });

  it('collapses expanded card on second tap', () => {
    const { getByTestId, queryByText } = render(<MatchupEdgeModule matchups={mockMatchups} />);

    fireEvent.press(getByTestId('matchup-card-1'));
    expect(queryByText('CGY allows 4th-most goals to centers')).toBeTruthy();

    fireEvent.press(getByTestId('matchup-card-1'));
    expect(queryByText('CGY allows 4th-most goals to centers')).toBeNull();
  });
});
