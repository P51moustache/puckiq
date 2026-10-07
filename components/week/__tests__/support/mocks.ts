/**
 * Module stand-ins so Week components render under react-test-renderer in Node.
 * Use from a test with, e.g.:
 *   jest.mock('react-native', () => require('./support/mocks').reactNativeMock());
 */

import React from 'react';

type HostProps = { children?: React.ReactNode; [key: string]: unknown };
type PressableProps = HostProps & {
  style?: unknown;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
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
    ScrollView: host('ScrollView'),
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
    Linking: { openURL: () => Promise.resolve() },
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

/** react-native-svg as plain host elements (no native module in Node). */
export function svgMock() {
  const Svg = host('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Defs: host('Defs'),
    Pattern: host('Pattern'),
    Line: host('Line'),
    Rect: host('Rect'),
  };
}

/**
 * PlayerAvatar with the tile stubbed out (no headshot loading in Node) and names as
 * plain text; everything else (splitName…) stays real.
 */
export function playerAvatarMock() {
  return {
    ...jest.requireActual('../../../coach/PlayerAvatar'),
    PlayerAvatar: () => null,
    PlayerName: ({ name }: { name: string }) => React.createElement('Text', { testID: 'player-name' }, name),
  };
}
