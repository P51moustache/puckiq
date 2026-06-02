/**
 * Tests for ShotLocationMap component
 * Tests: rendering, empty state, legend, zone colors
 */

import React from 'react';
import ShotLocationMap from '../ShotLocationMap';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Rect: 'Rect',
  Text: 'SvgText',
}));

jest.mock('../../constants/theme', () => ({
  theme: { text: '#fff', accent: '#60a5fa', subtext: '#aaa', card: '#123' },
}));

// Mock useState so it works outside React runtime
let tooltipState: any = null;
const setTooltipMock = jest.fn((val: any) => { tooltipState = val; });
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (init: any) => [tooltipState ?? init, setTooltipMock],
  };
});

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

function collectTexts(element: any): string[] {
  if (!element) return [];
  if (typeof element === 'string' || typeof element === 'number') return [String(element)];
  const texts: string[] = [];
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    texts.push(...collectTexts(child));
  }
  return texts;
}

describe('ShotLocationMap', () => {
  beforeEach(() => {
    tooltipState = null;
    setTooltipMock.mockClear();
  });

  it('returns null for empty zones', () => {
    const el = ShotLocationMap({ zones: [] });
    expect(el).toBeNull();
  });

  it('returns null for undefined zones', () => {
    const el = ShotLocationMap({ zones: undefined as any });
    expect(el).toBeNull();
  });

  it('renders with valid zone data', () => {
    const zones = [
      { area: 'slotNear', shots: 10, goals: 3, pctg: 0.3 },
      { area: 'leftMid', shots: 5, goals: 1, pctg: 0.2 },
    ];
    const el = ShotLocationMap({ zones });
    expect(findByTestID(el, 'shot-location-map')).toBeTruthy();
  });

  it('renders legend with Hot/Warm/Cool labels', () => {
    const zones = [
      { area: 'slotNear', shots: 10, goals: 3, pctg: 0.3 },
    ];
    const el = ShotLocationMap({ zones });
    const texts = collectTexts(el);
    expect(texts).toContain('Hot');
    expect(texts).toContain('Warm');
    expect(texts).toContain('Cool');
  });

  it('skips zones with unknown area names', () => {
    const zones = [
      { area: 'unknownZone', shots: 5, goals: 1, pctg: 0.2 },
    ];
    const el = ShotLocationMap({ zones });
    // Should still render the container but the unknown zone rect returns null
    expect(findByTestID(el, 'shot-location-map')).toBeTruthy();
  });

  it('does not show tooltip by default', () => {
    const zones = [
      { area: 'slotNear', shots: 10, goals: 3, pctg: 0.3 },
    ];
    const el = ShotLocationMap({ zones });
    const tooltip = findByTestID(el, 'shot-location-tooltip');
    expect(tooltip).toBeNull();
  });
});
