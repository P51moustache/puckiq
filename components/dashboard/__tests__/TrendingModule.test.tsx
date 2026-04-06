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
    const { getByText } = render(<TrendingModule players={mockPlayers} />);
    expect(getByText('Trending Now')).toBeTruthy();
    expect(getByText('Connor McDavid')).toBeTruthy();
    expect(getByText('Nathan MacKinnon')).toBeTruthy();
    expect(getByText('Auston Matthews')).toBeTruthy();
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

  it('expands card on tap to show extra detail', () => {
    const { getByTestId, queryByTestId } = render(
      <TrendingModule players={mockPlayers} />
    );
    // Initially no expanded content
    expect(queryByTestId('expanded-1')).toBeNull();
    // Tap the card
    fireEvent.press(getByTestId('card-1'));
    // Now expanded content should appear
    expect(getByTestId('expanded-1')).toBeTruthy();
  });

  it('shows Watch button in expanded state', () => {
    const { getByTestId, getByText } = render(
      <TrendingModule players={mockPlayers} />
    );
    fireEvent.press(getByTestId('card-1'));
    expect(getByText('Watch')).toBeTruthy();
  });

  it('shows trend indicator', () => {
    const { getByTestId } = render(<TrendingModule players={mockPlayers} />);
    const trend1 = getByTestId('trend-1');
    expect(trend1.props.children).toBe('↑');
    const trend3 = getByTestId('trend-3');
    expect(trend3.props.children).toBe('↓');
  });
});
