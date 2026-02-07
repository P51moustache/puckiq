/**
 * Tests for ZoneTimeChart component
 * Tests: zone rendering, labels, league avg
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('../../constants/theme', () => ({
  theme: { text: '#fff', accent: '#60a5fa', subtext: '#aaa' },
}));

import React from 'react';
import ZoneTimeChart from '../ZoneTimeChart';

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

describe('ZoneTimeChart', () => {
  it('has testID zone-time-chart', () => {
    const el = ZoneTimeChart({ offPctg: 42.5, neutPctg: 18.0, defPctg: 39.5 });
    expect(el?.props?.testID).toBe('zone-time-chart');
  });

  it('renders zone percentages', () => {
    const el = ZoneTimeChart({ offPctg: 42.5, neutPctg: 18.0, defPctg: 39.5 });
    const joined = collectTexts(el).join('');
    expect(joined).toContain('OFF 42.5%');
    expect(joined).toContain('DEF 39.5%');
  });

  it('renders league average when provided', () => {
    const el = ZoneTimeChart({
      offPctg: 42.5,
      neutPctg: 18.0,
      defPctg: 39.5,
      leagueAvg: { offPctg: 33.0, neutPctg: 34.0, defPctg: 33.0 },
    });
    const avg = findByTestID(el, 'zone-time-league-avg');
    expect(avg).toBeTruthy();
  });

  it('does not render league avg when not provided', () => {
    const el = ZoneTimeChart({ offPctg: 42.5, neutPctg: 18.0, defPctg: 39.5 });
    const avg = findByTestID(el, 'zone-time-league-avg');
    expect(avg).toBeNull();
  });

  it('handles zero values without crashing', () => {
    const el = ZoneTimeChart({ offPctg: 0, neutPctg: 0, defPctg: 0 });
    expect(el?.props?.testID).toBe('zone-time-chart');
  });
});
