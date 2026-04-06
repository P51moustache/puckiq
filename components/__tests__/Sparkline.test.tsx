jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
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

import React from 'react';
import { render } from '@testing-library/react-native';
import { Sparkline } from '../Sparkline';

describe('Sparkline', () => {
  it('renders bars from data points', () => {
    const { getAllByTestId } = render(<Sparkline data={[1, 3, 2, 5, 4]} />);
    expect(getAllByTestId('sparkline-bar')).toHaveLength(5);
  });

  it('renders no bars for empty data', () => {
    const { queryAllByTestId } = render(<Sparkline data={[]} />);
    expect(queryAllByTestId('sparkline-bar')).toHaveLength(0);
  });

  it('uses provided color', () => {
    const { getAllByTestId } = render(
      <Sparkline data={[2, 4]} color="#ff0000" />
    );
    const bars = getAllByTestId('sparkline-bar');
    expect(bars[0].props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#ff0000' })
    );
  });

  it('uses default blueLight color when none provided', () => {
    const { getAllByTestId } = render(<Sparkline data={[3]} />);
    const bar = getAllByTestId('sparkline-bar')[0];
    expect(bar.props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#4cc9f0' })
    );
  });

  it('scales bar heights relative to max value', () => {
    const { getAllByTestId } = render(
      <Sparkline data={[2, 4]} height={40} />
    );
    const bars = getAllByTestId('sparkline-bar');
    // max is 4, so bar for value 2 should be 50% of height, bar for 4 should be 100%
    expect(bars[0].props.style.height).toBe(20);
    expect(bars[1].props.style.height).toBe(40);
  });

  it('handles single data point', () => {
    const { getAllByTestId } = render(<Sparkline data={[5]} />);
    expect(getAllByTestId('sparkline-bar')).toHaveLength(1);
  });

  it('handles all-zero data gracefully', () => {
    const { getAllByTestId } = render(<Sparkline data={[0, 0, 0]} />);
    const bars = getAllByTestId('sparkline-bar');
    expect(bars).toHaveLength(3);
    // With all zeros, bars should have minimum height (1px)
    bars.forEach((bar) => {
      expect(bar.props.style.height).toBe(1);
    });
  });
});
