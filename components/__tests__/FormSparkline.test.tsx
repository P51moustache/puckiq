/**
 * Tests for FormSparkline component
 */

import React from 'react';
import FormSparkline from '../FormSparkline';

jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Polyline: 'Polyline',
  Circle: 'Circle',
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

function findByType(element: any, type: string): any {
  if (!element) return null;
  if (element?.type === type) return element;
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    if (typeof child === 'object') {
      const found = findByType(child, type);
      if (found) return found;
    }
  }
  return null;
}

function findAllByType(element: any, type: string): any[] {
  const results: any[] = [];
  if (!element) return results;
  if (element?.type === type) results.push(element);
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    if (typeof child === 'object') {
      results.push(...findAllByType(child, type));
    }
  }
  return results;
}

describe('FormSparkline', () => {
  it('renders with valid results', () => {
    const el = FormSparkline({
      results: ['W', 'L', 'W', 'OTL', 'W'],
    });
    expect(el).not.toBeNull();
    expect(findByTestID(el, 'form-sparkline')).toBeTruthy();
  });

  it('returns null for empty results', () => {
    const el = FormSparkline({ results: [] });
    expect(el).toBeNull();
  });

  it('returns null for single result (needs at least 2)', () => {
    const el = FormSparkline({ results: ['W'] });
    expect(el).toBeNull();
  });

  it('renders an SVG with Polyline and Circle', () => {
    const el = FormSparkline({
      results: ['W', 'L', 'W'],
    });
    const polyline = findByType(el, 'Polyline');
    expect(polyline).toBeTruthy();
    expect(polyline.props.points).toBeTruthy();

    const circle = findByType(el, 'Circle');
    expect(circle).toBeTruthy();
  });

  it('uses green dot color for recent win', () => {
    const el = FormSparkline({ results: ['W', 'L', 'W'] });
    const circle = findByType(el, 'Circle');
    expect(circle.props.fill).toBe('#10b981');
  });

  it('uses red dot color for recent loss', () => {
    const el = FormSparkline({ results: ['L', 'W', 'W'] });
    const circle = findByType(el, 'Circle');
    expect(circle.props.fill).toBe('#ef4444');
  });

  it('uses yellow dot color for recent OTL', () => {
    const el = FormSparkline({ results: ['OTL', 'W', 'L'] });
    const circle = findByType(el, 'Circle');
    expect(circle.props.fill).toBe('#fbbf24');
  });

  it('accepts custom width and height', () => {
    const el = FormSparkline({
      results: ['W', 'L'],
      width: 80,
      height: 24,
    });
    expect(el).not.toBeNull();
    const svg = findByType(el, 'Svg');
    expect(svg.props.width).toBe(80);
    expect(svg.props.height).toBe(24);
  });

  it('generates polyline points string with correct number of points', () => {
    const results: ('W' | 'L' | 'OTL')[] = ['W', 'L', 'OTL', 'W', 'L'];
    const el = FormSparkline({ results });
    const polyline = findByType(el, 'Polyline');
    const pointPairs = polyline.props.points.split(' ');
    expect(pointPairs).toHaveLength(5);
  });
});
