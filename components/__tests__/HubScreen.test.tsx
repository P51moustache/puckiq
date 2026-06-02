/**
 * Tests for components/HubScreen.tsx
 * Covers: authenticated vs unauthenticated states, subscription, notifications, about
 */

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import HubScreen from '../HubScreen';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    Switch: (props: any) => React.createElement('Switch', props),
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
    it('renders the Settings header', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(texts).toContain('Settings');
      // PageHeader uppercases the subtitle
      expect(texts).toContain('NOTIFICATIONS · ACCOUNT · ABOUT');
    });

    it('shows sign-in buttons', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'sign-in-apple')).toHaveLength(1);
      expect(findByTestId(tree, 'sign-in-google')).toHaveLength(1);
      // Email sign-in was removed in the redesign; only Apple + Google remain.
      expect(findByTestId(tree, 'sign-in-email')).toHaveLength(0);
    });

    it('prompts the user to sign in to enable notifications', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('Sign in below to enable notifications.');
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
    // The redesigned Settings screen no longer renders an in-screen subscription
    // upsell. Free-tier state is now communicated by disabling the notification
    // toggles (see "Notification preferences" below) rather than a Free Plan
    // badge / Upgrade to Pro button.
    it('does not render an Upgrade to Pro button or Free Plan badge', () => {
      const tree = renderHub();
      const texts = getAllText(tree);
      expect(findByTestId(tree, 'upgrade-button')).toHaveLength(0);
      expect(texts).not.toContain('Upgrade to Pro');
      expect(texts).not.toContain('Free Plan');
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

    it('enables all toggles when authenticated + premium', async () => {
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
        expect(findByTestId(tree, testID)[0].props.disabled).toBe(false);
      }
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
    it('shows version 3.0.0', () => {
      const tree = renderHub();
      expect(getAllText(tree)).toContain('3.0.0');
    });

    it('shows Support link', () => {
      const tree = renderHub();
      expect(findByTestId(tree, 'support-link')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Support');
    });
  });
});
