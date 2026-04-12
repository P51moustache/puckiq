jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent, ...props }: any) => {
      if (!data || data.length === 0) {
        const empty = typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent || null;
        return React.createElement('FlatList', props, empty);
      }
      return React.createElement(
        'FlatList',
        props,
        data.map((item: any, index: number) =>
          React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : index },
            renderItem({ item, index })
          )
        )
      );
    },
    TouchableOpacity: ({ children, ...props }: any) =>
      React.createElement('TouchableOpacity', props, children),
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
    interpolate: (value: number, input: number[], output: number[]) => {
      // Simple linear interpolation mock
      if (value <= input[0]) return output[0];
      if (value >= input[input.length - 1]) return output[output.length - 1];
      for (let i = 0; i < input.length - 1; i++) {
        if (value >= input[i] && value <= input[i + 1]) {
          const t = (value - input[i]) / (input[i + 1] - input[i]);
          return output[i] + t * (output[i + 1] - output[i]);
        }
      }
      return output[0];
    },
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
import { TrendingModule, TrendingPlayer } from '../TrendingModule';

const mockPlayers: TrendingPlayer[] = [
  {
    id: 1,
    name: 'Connor McDavid',
    team: 'EDM',
    flameCount: 5,
    recentPoints: [2, 1, 3, 2, 4],
    trend: 'up',
  },
  {
    id: 2,
    name: 'Nathan MacKinnon',
    team: 'COL',
    flameCount: 3,
    recentPoints: [1, 0, 2, 1, 1],
    trend: 'stable',
  },
  {
    id: 3,
    name: 'Auston Matthews',
    team: 'TOR',
    flameCount: 1,
    recentPoints: [0, 1, 0, 0, 1],
    trend: 'down',
  },
];

describe('TrendingModule', () => {
  it('renders horizontal scroll of player cards', () => {
    const { getByText, getAllByText } = render(<TrendingModule players={mockPlayers} />);
    expect(getByText('Trending Now')).toBeTruthy();
    // Names appear on both front and back faces
    expect(getAllByText('Connor McDavid').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Nathan MacKinnon').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Auston Matthews').length).toBeGreaterThanOrEqual(1);
  });

  it('shows flame count based on streak intensity', () => {
    const { getByTestId } = render(<TrendingModule players={mockPlayers} />);
    // McDavid has flameCount 5
    const flames1 = getByTestId('flames-1');
    expect(flames1.props.children).toBe('🔥🔥🔥🔥🔥');
    // MacKinnon has flameCount 3
    const flames2 = getByTestId('flames-2');
    expect(flames2.props.children).toBe('🔥🔥🔥');
    // Matthews has flameCount 1
    const flames3 = getByTestId('flames-3');
    expect(flames3.props.children).toBe('🔥');
  });

  it('shows sparkline on each card', () => {
    const { getAllByTestId } = render(<TrendingModule players={mockPlayers} />);
    expect(getAllByTestId('sparkline-container')).toHaveLength(3);
  });

  it('renders empty state when no players', () => {
    const { getByText } = render(<TrendingModule players={[]} />);
    expect(getByText('No trending players right now')).toBeTruthy();
  });

  it('renders back face with "Why trending" details', () => {
    const { getByTestId, getAllByText } = render(
      <TrendingModule players={mockPlayers} />
    );
    // Back face should be rendered (always present, hidden via animation opacity)
    expect(getByTestId('back-1')).toBeTruthy();
    // Each card has a "Why trending" header on its back
    expect(getAllByText('Why trending').length).toBe(3);
  });

  it('shows stats on back face', () => {
    const { getByTestId } = render(<TrendingModule players={mockPlayers} />);
    const backStats = getByTestId('back-stats-1');
    // McDavid: 2+1+3+2+4 = 12
    expect(backStats.props.children).toEqual(['Last ', 5, ' games: ', 12, ' pts']);
  });

  it('shows Watch button on back face', () => {
    const onWatch = jest.fn();
    const { getByTestId } = render(
      <TrendingModule players={mockPlayers} onWatch={onWatch} />
    );
    // Watch button is on the back face
    const watchBtn = getByTestId('watch-1');
    fireEvent.press(watchBtn);
    expect(onWatch).toHaveBeenCalledWith(1);
  });

  it('card is tappable for flip interaction', () => {
    const { getByTestId } = render(<TrendingModule players={mockPlayers} />);
    // Card should be pressable (flip trigger)
    const card = getByTestId('card-1');
    expect(card.props.onPress).toBeDefined();
    // Should not throw when pressed
    fireEvent.press(card);
  });

  it('shows trend indicator', () => {
    const { getByTestId } = render(<TrendingModule players={mockPlayers} />);
    const trend1 = getByTestId('trend-1');
    expect(trend1.props.children).toBe('↑');
    const trend3 = getByTestId('trend-3');
    expect(trend3.props.children).toBe('↓');
  });
});
