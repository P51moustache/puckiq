/**
 * react-native stand-ins for League tests under react-test-renderer in Node: host elements for
 * views and inputs, an AppState tests can drive, and spies for Share, Alert and Linking.
 *   jest.mock('react-native', () => require('./support/reactNative').reactNativeMock());
 * (Same idea as components/week/__tests__/support/mocks.ts, plus the inputs and native APIs the
 * League screens use — a candidate to merge into one shared test-support module.)
 */

import React from 'react';

type HostProps = { children?: React.ReactNode; [key: string]: unknown };
type PressableProps = HostProps & {
  style?: unknown;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
};
type AppStateListener = (state: string) => void;

/** The app's foreground state; `appState.set('background')` notifies every listener. */
export const appState = {
  current: 'active',
  listeners: new Set<AppStateListener>(),
  set(next: string) {
    this.current = next;
    this.listeners.forEach((listener) => listener(next));
  },
  reset() {
    this.current = 'active';
    this.listeners.clear();
  },
};

/** Calls into native APIs, for assertions. */
export const nativeSpies = {
  share: jest.fn((_content: { message: string }) => Promise.resolve({ action: 'sharedAction' })),
  alert: jest.fn(),
  openURL: jest.fn((_url: string) => Promise.resolve()),
};

/** Window width the mocked `useWindowDimensions` reports. Tests set it before rendering. */
export const mockWindow = { width: 390 };

function host(name: string) {
  const Host = ({ children, ...props }: HostProps) => React.createElement(name, props, children);
  Host.displayName = name;
  return Host;
}

export function reactNativeMock() {
  class AnimatedValue {
    constructor(public value: number) {}
  }
  const Pressable = ({ children, style, ...props }: PressableProps) =>
    React.createElement(
      'Pressable',
      { ...props, style: typeof style === 'function' ? style({ pressed: false }) : style },
      typeof children === 'function' ? children({ pressed: false }) : children,
    );
  return {
    View: host('View'),
    Text: host('Text'),
    TextInput: host('TextInput'),
    ScrollView: host('ScrollView'),
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    // Like the real Modal: nothing renders until it's visible.
    Modal: ({ visible, children, ...props }: HostProps & { visible?: boolean }) =>
      visible ? React.createElement('Modal', props, children) : null,
    RefreshControl: host('RefreshControl'),
    ActivityIndicator: host('ActivityIndicator'),
    Pressable,
    StyleSheet: {
      create: <T>(styles: T): T => styles,
      flatten: (style: unknown) => style,
      hairlineWidth: 0.5,
      absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    },
    Platform: { OS: 'ios', select: (options: { ios?: unknown }) => options.ios },
    Linking: { openURL: (url: string) => nativeSpies.openURL(url) },
    Share: { share: (content: { message: string }) => nativeSpies.share(content) },
    Alert: { alert: (...args: unknown[]) => nativeSpies.alert(...args) },
    AppState: {
      get currentState() {
        return appState.current;
      },
      addEventListener: (_event: string, listener: AppStateListener) => {
        appState.listeners.add(listener);
        return { remove: () => appState.listeners.delete(listener) };
      },
    },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove: () => undefined }),
    },
    useWindowDimensions: () => ({ width: mockWindow.width, height: 900, scale: 3, fontScale: 1 }),
    Animated: {
      Value: AnimatedValue,
      View: host('AnimatedView'),
      loop: () => ({ start: () => undefined, stop: () => undefined }),
      sequence: () => undefined,
      timing: () => undefined,
    },
    Easing: { inOut: () => undefined, quad: undefined },
  };
}

/** expo-apple-authentication's button as a host element; enums as plain numbers. */
export function appleAuthMock() {
  return {
    AppleAuthenticationButton: host('AppleAuthenticationButton'),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
}

/**
 * Alert.alert's buttons from the latest call, so a test can "tap" one by its text.
 * Returns false when there was no alert or no such button.
 */
export function pressAlertButton(text: string): boolean {
  const call = nativeSpies.alert.mock.calls[nativeSpies.alert.mock.calls.length - 1];
  const buttons = (call?.[2] ?? []) as { text?: string; onPress?: () => void }[];
  const button = buttons.find((entry) => entry.text === text);
  if (!button) return false;
  button.onPress?.();
  return true;
}
