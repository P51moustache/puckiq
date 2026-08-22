const mockUseSubscription = jest.fn(() => ({ isPremium: false, loading: false, refresh: jest.fn() }));
const mockAdSlot = jest.fn(() => false);

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../../constants/monetization', () => ({
  isAdSlotEnabled: () => mockAdSlot(),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    StyleSheet: { create: (s: any) => s },
  };
});

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import SportsAdSlot from '../SportsAdSlot';

function render() {
  let tree: any;
  act(() => { tree = create(<SportsAdSlot />); });
  return tree;
}

describe('SportsAdSlot', () => {
  beforeEach(() => {
    mockAdSlot.mockReturnValue(false);
    mockUseSubscription.mockReturnValue({ isPremium: false, loading: false, refresh: jest.fn() });
  });

  it('renders nothing when the flag is off', () => {
    const tree = render();
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing for Pro users even if the flag is on', () => {
    mockAdSlot.mockReturnValue(true);
    mockUseSubscription.mockReturnValue({ isPremium: true, loading: false, refresh: jest.fn() });
    const tree = render();
    expect(tree.toJSON()).toBeNull();
  });

  it('shows a dismissible placeholder when the flag is on', () => {
    mockAdSlot.mockReturnValue(true);
    const tree = render();
    const slots = tree.root.findAll((n: any) => n.props.testID === 'sports-ad-slot' && typeof n.type === 'string');
    expect(slots).toHaveLength(1);
    const dismiss = tree.root.findAll((n: any) => n.props.testID === 'sports-ad-dismiss')[0];
    act(() => { dismiss.props.onPress(); });
    expect(tree.toJSON()).toBeNull();
  });
});
