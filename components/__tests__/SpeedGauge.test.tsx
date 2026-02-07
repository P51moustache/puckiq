/**
 * Tests for SpeedGauge component
 * Tests: value display, unit, label, percentile, league avg
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn(() => ({ value: 0 })),
  withTiming: jest.fn((val: number) => val),
  Easing: { out: jest.fn(() => 'easeOut'), cubic: 'cubic' },
}));

jest.mock('../../constants/theme', () => ({
  theme: { text: '#fff', accent: '#60a5fa', subtext: '#aaa', card: '#123' },
}));

// Mock React hooks that fail outside runtime
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useEffect: jest.fn(),
  };
});

import React from 'react';
import SpeedGauge from '../SpeedGauge';

function collectTexts(element: any): string[] {
  if (!element) return [];
  if (typeof element === 'string' || typeof element === 'number') return [String(element)];
  const texts: string[] = [];
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    texts.push(...collectTexts(child));
  }
  return texts;
}

function findByTestID(element: any, testID: string): any {
  if (!element) return null;
  if (element?.props?.testID === testID) return element;
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    if (typeof child === 'object') {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  return null;
}

describe('SpeedGauge', () => {
  it('has testID speed-gauge', () => {
    const el = SpeedGauge({ value: 95.0, label: 'Shot' });
    expect(el?.props?.testID).toBe('speed-gauge');
  });

  it('renders value and label', () => {
    const el = SpeedGauge({ value: 98.5, label: 'Top Shot' });
    const texts = collectTexts(el);
    expect(texts).toContain('98.5');
    expect(texts).toContain('Top Shot');
    expect(texts).toContain('mph');
  });

  it('renders custom unit', () => {
    const el = SpeedGauge({ value: 24.1, unit: 'km/h', label: 'Speed' });
    const texts = collectTexts(el);
    expect(texts).toContain('km/h');
  });

  it('renders percentile bar when provided', () => {
    const el = SpeedGauge({ value: 95.0, label: 'Shot', percentile: 72 });
    const bar = findByTestID(el, 'speed-gauge-percentile-bar');
    expect(bar).toBeTruthy();
  });

  it('does not render percentile bar when not provided', () => {
    const el = SpeedGauge({ value: 95.0, label: 'Shot' });
    const bar = findByTestID(el, 'speed-gauge-percentile-bar');
    expect(bar).toBeNull();
  });

  it('renders league average when provided', () => {
    const el = SpeedGauge({ value: 95.0, label: 'Shot', leagueAvg: 83.3 });
    const avg = findByTestID(el, 'speed-gauge-league-avg');
    expect(avg).toBeTruthy();
  });
});
