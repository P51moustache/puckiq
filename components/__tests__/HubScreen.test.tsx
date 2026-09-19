/**
 * Tests for components/HubScreen.tsx
 * Covers: authenticated vs unauthenticated states, subscription, notifications, about
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import HubScreen from '../HubScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => ({ origin: 'following' }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    Switch: (props: any) => React.createElement('Switch', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Platform: { OS: 'ios' },
    Modal: ({ children, ...props }: any) => React.createElement('Modal', props, children),
    Linking: { openURL: jest.fn() },
    Alert: { alert: jest.fn() },
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
  showPaywall: jest.fn(),
  subscriptionUnavailableReason: null as string | null,
  retrySubscription: jest.fn(),
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
    mockSubscription.loading = false;
    mockSubscription.subscriptionUnavailableReason = null;
    mockAuthContext.error = null;
  });

  describe('when user is NOT authenticated', () => {
    it('renders the Settings header', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(texts).toContain('SETTINGS');
      expect(tree.root.findByProps({ accessibilityLabel: 'Back' })).toBeTruthy();
    });

    it('shows sign-in buttons', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-in-apple')).toHaveLength(1);
      expect(findByTestId(tree, 'sign-in-google')).toHaveLength(1);
      // Email sign-in was removed in the redesign; only Apple + Google remain.
      expect(findByTestId(tree, 'sign-in-email')).toHaveLength(0);
    });

    it('states that remote alerts are unavailable in this build', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Remote alerts are unavailable in this build.');
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

    it('shows a provider-specific accessible busy state while sign-in is pending', async () => {
      let resolve!: (ok: boolean) => void;
      mockSignInWithGoogle.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
      const tree = renderHub();
      act(() => { findByTestId(tree, 'sign-in-google')[0].props.onPress(); });
      const button = findByTestId(tree, 'sign-in-google')[0];
      expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
      expect(getAllText(tree)).toContain('Opening Google…');
      await act(async () => { resolve(false); await Promise.resolve(); });
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

    it('explains retained device data before sign out', () => {
      const tree = renderHub();
      const btn = findByTestId(tree, 'sign-out-button')[0];
      act(() => { btn.props.onPress(); });
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(findByTestId(tree, 'sign-out-confirm')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Saved cards, watched players, and team preferences stay on this device.');
    });

    it('loads notification prefs from Supabase', async () => {
      await act(async () => { create(<HubScreen />); });
      expect(mockLoadPrefs).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Subscription section', () => {
    it('renders subscription options for guests and opens the shared paywall', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(findByTestId(tree, 'subscription-section')).toHaveLength(1);
      expect(findByTestId(tree, 'subscription-options-button')[0].props.accessibilityRole).toBe('button');
      expect(texts).toContain('Subscription options and restore');
      act(() => { findByTestId(tree, 'subscription-options-button')[0].props.onPress(); });
      expect(mockSubscription.showPaywall).toHaveBeenCalledWith('Subscription options and restore');
    });

    it('renders the same subscription entry for premium users', () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;
      const tree = renderHub();
      expect(getAllText(tree)).toContain('PuckIQ Pro active');
      expect(findByTestId(tree, 'subscription-options-button')).toHaveLength(1);
    });

    it('shows the provider unavailable reason and retries setup without opening the paywall', () => {
      mockSubscription.subscriptionUnavailableReason = 'RevenueCat is not configured for this platform.';
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Subscriptions unavailable');
      expect(getAllText(tree)).toContain('RevenueCat is not configured for this platform.');
      act(() => { findByTestId(tree, 'subscription-options-button')[0].props.onPress(); });
      expect(mockSubscription.retrySubscription).toHaveBeenCalledTimes(1);
      expect(mockSubscription.showPaywall).not.toHaveBeenCalled();
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

    // The redesign dropped the per-row "Pro feature" text labels. Free-tier
    // gating is now expressed purely by disabling every notification toggle.
    it('disables all toggles when not premium', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(texts.filter((t: string) => t === 'Pro feature')).toHaveLength(0);
      for (const testID of [
        'toggle-morning-brief',
        'toggle-goalie-confirmed',
        'toggle-injury-alerts',
        'toggle-game-reminders',
        'toggle-waiver-alerts',
      ]) {
        expect(findByTestId(tree, testID)[0].props.disabled).toBe(true);
      }
    });

    it('keeps all remote alert toggles disabled when authenticated + premium', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });
      const texts = getAllText(tree);
      expect(texts.filter((t: string) => t === 'Pro feature')).toHaveLength(0);
      for (const testID of [
        'toggle-morning-brief',
        'toggle-goalie-confirmed',
        'toggle-injury-alerts',
        'toggle-game-reminders',
        'toggle-waiver-alerts',
      ]) {
        expect(findByTestId(tree, testID)[0].props.disabled).toBe(true);
      }
    });

    it('does not change or save remote alert preferences when premium', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });

      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(toggle.props.disabled).toBe(true);

      await act(async () => { toggle.props.onValueChange(true); });
      const updated = findByTestId(tree, 'toggle-morning-brief')[0];
      expect(updated.props.value).toBe(false);
      expect(mockSavePrefs).not.toHaveBeenCalled();
    });

    it('does not save remote alert preferences on toggle', async () => {
      mockAuthContext.user = { email: 'pro@puckiq.com', id: 'user-pro' };
      mockSubscription.isPremium = true;

      let tree: any;
      await act(async () => { tree = create(<HubScreen />); });

      const toggle = findByTestId(tree, 'toggle-morning-brief')[0];
      await act(async () => { toggle.props.onValueChange(true); });

      expect(mockSavePrefs).not.toHaveBeenCalled();
    });
  });

  describe('About section', () => {
    it('shows version 3.0.0', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('3.0.0');
    });

    it('shows Support link', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'support-link')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Support');
    });

    it('opens actionable in-app help without requiring a configured contact', () => {
      const tree = renderHub();
      act(() => { findByTestId(tree, 'support-link')[0].props.onPress(); });
      expect(findByTestId(tree, 'support-modal')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Subscription recovery');
      expect(getAllText(tree)).toContain('Feed and schedule recovery');
      expect(findByTestId(tree, 'help-subscription-options')).toHaveLength(1);
      expect(findByTestId(tree, 'help-go-tonight')).toHaveLength(1);
    });
  });
});
