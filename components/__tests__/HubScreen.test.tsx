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
    Platform: { OS: 'ios' },
    StyleSheet: { create: (s: any) => s },
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
    it('renders the Hub title', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Hub');
    });

    it('shows sign-in buttons', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-in-apple')).toHaveLength(1);
      expect(findByTestId(tree, 'sign-in-google')).toHaveLength(1);
      expect(findByTestId(tree, 'sign-in-email')).toHaveLength(1);
    });

    it('does NOT show sign-out button', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-out-button')).toHaveLength(0);
    });

    it('calls signInWithApple when Apple button pressed', () => {
      const tree = renderHub();
      const btn = findByTestId(tree, 'sign-in-apple')[0];
      act(() => { btn.props.onPress(); });
      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
    });

    it('calls signInWithGoogle when Google button pressed', () => {
      const tree = renderHub();
      const btn = findByTestId(tree, 'sign-in-google')[0];
      act(() => { btn.props.onPress(); });
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  describe('when user IS authenticated', () => {
    beforeEach(() => {
      mockAuthContext.user = { email: 'test@puckiq.com', id: 'user-123' };
    });

    it('shows user email', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('test@puckiq.com');
    });

    it('shows sign-out button', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-out-button')).toHaveLength(1);
    });

    it('does NOT show sign-in buttons', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-in-apple')).toHaveLength(0);
      expect(findByTestId(tree, 'sign-in-google')).toHaveLength(0);
      expect(findByTestId(tree, 'sign-in-email')).toHaveLength(0);
    });

    it('calls signOut when sign-out button pressed', () => {
      const tree = renderHub();
      const btn = findByTestId(tree, 'sign-out-button')[0];
      act(() => { btn.props.onPress(); });
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('loads notification prefs from Supabase', async () => {
      await act(async () => { create(<HubScreen />); });
      expect(mockLoadPrefs).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Subscription section', () => {
    it('shows Free Plan badge', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Free Plan');
    });

    it('shows Upgrade to Pro button', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'upgrade-button')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Upgrade to Pro');
    });
  });

  describe('Notification preferences', () => {
    it('shows all five notification toggles', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'toggle-morning-brief')).toHaveLength(1);
      expect(findByTestId(tree, 'toggle-goalie-confirmed')).toHaveLength(1);
      expect(findByTestId(tree, 'toggle-injury-alerts')).toHaveLength(1);
      expect(findByTestId(tree, 'toggle-game-reminders')).toHaveLength(1);
      expect(findByTestId(tree, 'toggle-waiver-alerts')).toHaveLength(1);
    });

    it('shows notification labels', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(texts).toContain('Morning Brief');
      expect(texts).toContain('Goalie Confirmed');
      expect(texts).toContain('Injury Alerts');
      expect(texts).toContain('Game Reminders');
      expect(texts).toContain('Waiver Alerts');
    });

    it('toggles start as off', () => {
      const tree = renderHub();
      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(toggle.props.value).toBe(false);
    });

    it('shows "Pro feature" labels when not premium', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(texts.filter((t: string) => t === 'Pro feature')).toHaveLength(5);
    });

    it('toggles are disabled when not premium', () => {
      const tree = renderHub();
      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(toggle.props.disabled).toBe(true);
    });

    it('does not show "Pro feature" labels when authenticated + premium', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });
      const texts = getAllText(tree);
      expect(texts.filter((t: string) => t === 'Pro feature')).toHaveLength(0);
    });

    it('can toggle morning brief on when premium', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });

      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(toggle.props.disabled).toBe(false);

      await act(async () => { toggle.props.onValueChange(true); });
      const updated = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(updated.props.value).toBe(true);
    });

    it('saves prefs to Supabase on toggle', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });

      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      await act(async () => { toggle.props.onValueChange(true); });

      expect(mockSavePrefs).toHaveBeenCalledWith('user-pro', expect.objectContaining({
        morningBrief: true,
      }));
    });
  });

  describe('About section', () => {
    it('shows version 2.2.0', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('2.2.0');
    });

    it('shows Support link', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'support-link')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Support');
    });
  });
});
