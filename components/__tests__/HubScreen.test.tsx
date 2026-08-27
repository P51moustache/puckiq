/**
 * Tests for components/HubScreen.tsx
 * Covers: authenticated vs unauthenticated states, subscription, notifications, about
 */

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    Switch: (props: any) => React.createElement('Switch', props),
    Alert: { alert: jest.fn() },
    Platform: { OS: 'ios' },
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 },
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }: any) => React.createElement('View', props, children),
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('View', { ...props, testID: `icon-${props.name}` }),
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const View = ({ children, ...props }: any) => React.createElement('View', props, children);
  return {
    __esModule: true,
    default: { View },
    FadeInUp: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) },
  };
});

// Mock AuthProvider
const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignOut = jest.fn();
const mockAuthContext = {
  session: null,
  user: null as any,
  initializing: false,
  error: null,
  isDeveloper: false,
  hasFullAccess: false,
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signInWithApple: mockSignInWithApple,
  signInWithGoogle: mockSignInWithGoogle,
  signOut: mockSignOut,
  refreshSession: jest.fn(),
};

jest.mock('../auth/AuthProvider', () => ({
  useAuthContext: () => mockAuthContext,
}));

// Mock SubscriptionProvider
const mockSubscription = {
  isPremium: false,
  loading: false,
  refresh: jest.fn(),
};

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockSubscription,
}));

// Mock notificationSettings service
const mockLoadPrefs = jest.fn().mockResolvedValue({
  morningBrief: false,
  goalieConfirmed: false,
  injuryAlerts: false,
  gameReminder: false,
  waiverAlerts: false,
});
const mockSavePrefs = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/notificationSettings', () => ({
  DEFAULT_FANTASY_PREFS: {
    morningBrief: true,
    goalieConfirmed: true,
    injuryAlerts: true,
    gameReminder: false,
    waiverAlerts: false,
  },
  loadFantasyNotificationPrefs: (...args: any[]) => mockLoadPrefs(...args),
  saveFantasyNotificationPrefs: (...args: any[]) => mockSavePrefs(...args),
}));

// Mock child components that have complex dependencies
jest.mock('../AccuracyTracker', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'accuracy-tracker' });
});

jest.mock('../Leaderboard', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'leaderboard' });
});

jest.mock('../ReferralCard', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'referral-card' });
});

jest.mock('../CoachAlertsCard', () => {
  const React = require('react');
  return () => React.createElement('View', { testID: 'coach-alerts' });
});

jest.mock('../ProPaywall', () => {
  const React = require('react');
  return ({ visible }: any) => (visible ? React.createElement('View', { testID: 'pro-paywall' }) : null);
});

jest.mock('../../services/subscription', () => ({
  restorePurchases: jest.fn().mockResolvedValue(false),
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import HubScreen from '../HubScreen';

// Helpers
function renderHub() {
  let tree: any;
  act(() => { tree = create(<HubScreen />); });
  return tree;
}

function findByTestId(root: any, testID: string): any[] {
  return root.root.findAll(
    (node: any) => node.props.testID === testID && typeof node.type === 'string'
  );
}

function getAllText(root: any): string[] {
  return root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      return '';
    })
    .filter(Boolean);
}

describe('HubScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.user = null;
    mockSubscription.isPremium = false;
  });

  describe('when user is NOT authenticated', () => {
    it('renders the Settings title', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Settings');
    });

    it('describes the paid $1.99 coach tool and does not show a Pro gate', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'plan-section')).toHaveLength(1);
      const tier = findByTestId(tree, 'plan-tier')[0].props.children;
      expect(Array.isArray(tier) ? tier.join('') : String(tier)).toMatch(/\$1\.99/);
      expect(findByTestId(tree, 'settings-subscribe')).toHaveLength(0);
      expect(findByTestId(tree, 'settings-restore')).toHaveLength(0);
      const texts = getAllText(tree);
      expect(texts.some((t) => t.includes('This week'))).toBe(true);
      expect(texts.some((t) => t.includes('Yahoo / ESPN'))).toBe(false);
      expect(texts.some((t) => t.includes('Lock of the Day'))).toBe(false);
    });

    it('does not offer Apple or Google sign-in', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-in-apple')).toHaveLength(0);
      expect(findByTestId(tree, 'sign-in-google')).toHaveLength(0);
      expect(findByTestId(tree, 'sign-out-button')).toHaveLength(0);
      expect(findByTestId(tree, 'device-section')).toHaveLength(1);
    });

    it('does not load fantasy notification prefs', async () => {
      await act(async () => { create(<HubScreen />); });
      expect(mockLoadPrefs).not.toHaveBeenCalled();
    });
  });

  describe('About section', () => {
    it('shows version 2.3.0', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('2.3.0');
    });

    it('shows Support link', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'support-link')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Support');
    });
  });
});
