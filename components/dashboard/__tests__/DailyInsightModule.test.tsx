jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Pressable: ({ children, onPress, onPressIn, onPressOut, ...props }: any) =>
      React.createElement('Pressable', { ...props, onPress, onPressIn, onPressOut }, children),
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

// Chainable animation builder mock
const makeAnimBuilder = () => {
  const builder: any = {};
  for (const m of ['delay', 'duration', 'springify', 'damping', 'stiffness', 'mass', 'withCallback', 'withInitialValues']) {
    builder[m] = () => builder;
  }
  return builder;
};

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
    FadeInUp: makeAnimBuilder(),
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
import DailyInsightModule from '../DailyInsightModule';

const bullishInsight = {
  headline: 'Suzuki has quietly outscored McDavid over the last 10 games',
  context: 'Nick Suzuki is averaging 1.24 pts/game over his last 10. His shooting percentage has climbed to 14.2%, well above his career average.',
  sentiment: 'bullish' as const,
  dataPoint: '12.4 pts vs 10.1 pts (last 10 GP)',
};

const bearishInsight = {
  headline: 'Matthews goal drought extends to 8 games',
  context: 'Auston Matthews has not scored in 8 consecutive games. His expected goals remain high, suggesting regression to the mean is coming.',
  sentiment: 'bearish' as const,
  dataPoint: '0 goals in 8 GP (2.4 xG)',
};

const surprisingInsight = {
  headline: 'Blackhawks have the best PP in the league this month',
  context: 'Chicago has converted at 34.5% over the past 30 days. Connor Bedard has been the catalyst with 6 PP goals.',
  sentiment: 'surprising' as const,
};

describe('DailyInsightModule', () => {
  it('renders bold headline text', () => {
    const { getByText } = render(<DailyInsightModule insight={bullishInsight} />);
    expect(getByText(bullishInsight.headline)).toBeTruthy();
  });

  it('uses sentiment-colored background for bullish', () => {
    const { getByTestId } = render(<DailyInsightModule insight={bullishInsight} />);
    const card = getByTestId('insight-card');
    const style = Array.isArray(card.props.style)
      ? Object.assign({}, ...card.props.style.filter(Boolean))
      : card.props.style;
    expect(style.backgroundColor).toBe('rgba(6, 214, 160, 0.12)');
  });

  it('uses sentiment-colored background for bearish', () => {
    const { getByTestId } = render(<DailyInsightModule insight={bearishInsight} />);
    const card = getByTestId('insight-card');
    const style = Array.isArray(card.props.style)
      ? Object.assign({}, ...card.props.style.filter(Boolean))
      : card.props.style;
    expect(style.backgroundColor).toBe('rgba(230, 57, 70, 0.12)');
  });

  it('expands to show context on tap', () => {
    const { getByTestId, queryByText } = render(<DailyInsightModule insight={bullishInsight} />);
    // Context should not be visible initially
    expect(queryByText(bullishInsight.context)).toBeNull();
    // Tap the card to expand
    fireEvent.press(getByTestId('insight-tap'));
    // Context should now be visible
    expect(queryByText(bullishInsight.context)).toBeTruthy();
    // Data point should also be visible
    expect(queryByText(bullishInsight.dataPoint!)).toBeTruthy();
  });

  it('has share button', () => {
    const { getByTestId } = render(<DailyInsightModule insight={bullishInsight} />);
    expect(getByTestId('share-button')).toBeTruthy();
  });

  it('renders empty state when no insight', () => {
    const { getByText } = render(<DailyInsightModule insight={null} />);
    expect(getByText('No insight today')).toBeTruthy();
  });

  it('renders module header with accent stripe', () => {
    const { getByText } = render(<DailyInsightModule insight={bullishInsight} />);
    expect(getByText('Daily Insight')).toBeTruthy();
  });

  it('uses amber background for surprising sentiment', () => {
    const { getByTestId } = render(<DailyInsightModule insight={surprisingInsight} />);
    const card = getByTestId('insight-card');
    const style = Array.isArray(card.props.style)
      ? Object.assign({}, ...card.props.style.filter(Boolean))
      : card.props.style;
    expect(style.backgroundColor).toBe('rgba(255, 214, 10, 0.12)');
  });

  it('does not show data point when not provided', () => {
    const { getByTestId, queryByText } = render(<DailyInsightModule insight={surprisingInsight} />);
    fireEvent.press(getByTestId('insight-tap'));
    expect(queryByText(surprisingInsight.context)).toBeTruthy();
    // No dataPoint in surprisingInsight
  });
});
