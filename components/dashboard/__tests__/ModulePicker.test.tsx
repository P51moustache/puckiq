import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ModulePicker from '../ModulePicker';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, ...props }: any) =>
      React.createElement('TouchableOpacity', props, children),
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    StyleSheet: {
      create: (s: any) => s,
      flatten: (style: any) => {
        if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
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

describe('ModulePicker', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 6 modules when visible', () => {
    const { getByTestId } = render(
      <ModulePicker visible={true} onComplete={mockOnComplete} />
    );

    expect(getByTestId('picker-startSit')).toBeTruthy();
    expect(getByTestId('picker-trending')).toBeTruthy();
    expect(getByTestId('picker-alerts')).toBeTruthy();
    expect(getByTestId('picker-waiverWire')).toBeTruthy();
    expect(getByTestId('picker-matchupEdge')).toBeTruthy();
    expect(getByTestId('picker-dailyInsight')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <ModulePicker visible={false} onComplete={mockOnComplete} />
    );

    expect(queryByTestId('picker-startSit')).toBeNull();
  });

  it('renders title and confirm button', () => {
    const { getByText, getByTestId } = render(
      <ModulePicker visible={true} onComplete={mockOnComplete} />
    );

    expect(getByText('What matters to you?')).toBeTruthy();
    expect(getByTestId('picker-confirm')).toBeTruthy();
  });

  it('calls onComplete with default enabled selection', () => {
    const { getByTestId } = render(
      <ModulePicker visible={true} onComplete={mockOnComplete} />
    );

    fireEvent.press(getByTestId('picker-confirm'));

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
    const result = mockOnComplete.mock.calls[0][0];
    expect(result).toHaveLength(6);
    // Output is ordered by MODULE_IDS, not DEFAULT_MODULES.
    expect(result[0]).toEqual({ id: 'startSit', enabled: true, order: 0 });
    // Defaults: startSit, trending, waiverWire, matchupEdge ON; alerts + dailyInsight OFF.
    const enabledById = Object.fromEntries(
      result.map((m: any) => [m.id, m.enabled])
    );
    expect(enabledById).toEqual({
      startSit: true,
      trending: true,
      alerts: false,
      waiverWire: true,
      matchupEdge: true,
      dailyInsight: false,
    });
  });

  it('toggles module off on press', () => {
    const { getByTestId } = render(
      <ModulePicker visible={true} onComplete={mockOnComplete} />
    );

    fireEvent.press(getByTestId('picker-startSit'));
    fireEvent.press(getByTestId('picker-confirm'));

    const result = mockOnComplete.mock.calls[0][0];
    expect(result.find((m: any) => m.id === 'startSit').enabled).toBe(false);
    expect(result.find((m: any) => m.id === 'trending').enabled).toBe(true);
  });

  it('toggles module back on after deselecting', () => {
    const { getByTestId } = render(
      <ModulePicker visible={true} onComplete={mockOnComplete} />
    );

    // startSit is enabled by default — deselect then reselect should return it to enabled.
    fireEvent.press(getByTestId('picker-startSit'));
    fireEvent.press(getByTestId('picker-startSit'));
    fireEvent.press(getByTestId('picker-confirm'));

    const result = mockOnComplete.mock.calls[0][0];
    expect(result.find((m: any) => m.id === 'startSit').enabled).toBe(true);
  });
});
