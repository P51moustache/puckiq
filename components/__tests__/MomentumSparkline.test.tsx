/**
 * Tests for MomentumSparkline component
 */

import React from 'react';
import MomentumSparkline from '../MomentumSparkline';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Polyline: 'Polyline',
}));

jest.mock('../../constants/theme', () => ({
  theme: { text: '#fff', accent: '#60a5fa', subtext: '#aaa' },
}));

jest.mock('../../constants/teamColors', () => ({
  getTeamColors: () => ({ primary: '#00205B', secondary: '#fff' }),
  getAccessibleTextColor: () => '#4488cc',
}));

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

describe('MomentumSparkline', () => {
  it('renders with data and trend', () => {
    const el = MomentumSparkline({ data: [1, 2, -1, 3, 2], trend: '↗', teamAbbrev: 'TOR' });
    expect(findByTestID(el, 'momentum-sparkline')).toBeTruthy();
    expect(findByTestID(el, 'momentum-trend-arrow')).toBeTruthy();
  });

  it('returns null for empty data', () => {
    const el = MomentumSparkline({ data: [], trend: '→', teamAbbrev: 'TOR' });
    expect(el).toBeNull();
  });

  it('renders correct trend arrow text', () => {
    const el = MomentumSparkline({ data: [1, 2, 3], trend: '↑', teamAbbrev: 'TOR' });
    const texts = collectTexts(el);
    expect(texts).toContain('↑');
  });

  it('renders compact mode', () => {
    const el = MomentumSparkline({ data: [1, 2, 3], trend: '→', teamAbbrev: 'TOR', compact: true });
    expect(findByTestID(el, 'momentum-sparkline')).toBeTruthy();
  });
});
