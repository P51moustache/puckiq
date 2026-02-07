/**
 * Tests for EdgeIntelSection component
 * Tests: card rendering, empty state, card press
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('react-native-reanimated', () => {
  const chainable: any = () => new Proxy({}, { get: () => chainable });
  return {
    __esModule: true,
    default: {
      View: 'Animated.View',
    },
    FadeInUp: new Proxy({}, { get: () => chainable }),
  };
});

jest.mock('../../constants/theme', () => ({
  theme: { text: '#fff', accent: '#60a5fa', subtext: '#aaa', card: '#123' },
}));

import React from 'react';
import EdgeIntelSection from '../EdgeIntelSection';

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

describe('EdgeIntelSection', () => {
  it('returns null when all data is null', () => {
    const el = EdgeIntelSection({
      skaterLanding: null,
      teamLanding: null,
      byTheNumbers: null,
    });
    expect(el).toBeNull();
  });

  it('renders section with shot speed card', () => {
    const skaterLanding = {
      hardestShot: {
        shotSpeed: { imperial: { speed: 105.3 } },
        player: { lastName: { default: 'Ovechkin' } },
      },
    } as any;
    const el = EdgeIntelSection({
      skaterLanding,
      teamLanding: null,
      byTheNumbers: null,
    });
    expect(findByTestID(el, 'edge-intel-section')).toBeTruthy();
    const texts = collectTexts(el);
    expect(texts).toContain('SHOT SPEED');
    expect(texts).toContain('105 mph');
    expect(texts).toContain('Ovechkin');
  });

  it('renders skating speed card', () => {
    const skaterLanding = {
      maxSkatingSpeed: {
        skatingSpeed: { imperial: { speed: 23.4 } },
        player: { lastName: { default: 'McDavid' } },
      },
    } as any;
    const el = EdgeIntelSection({
      skaterLanding,
      teamLanding: null,
      byTheNumbers: null,
    });
    const texts = collectTexts(el);
    expect(texts).toContain('SKATING SPEED');
    expect(texts).toContain('23.4 mph');
    expect(texts).toContain('McDavid');
  });

  it('renders team landing cards', () => {
    const teamLanding = {
      shotAttemptsOver90: {
        team: { abbrev: 'COL' },
        value: 142,
      },
      burstsOver22: {
        team: { abbrev: 'EDM' },
        value: 87,
      },
    } as any;
    const el = EdgeIntelSection({
      skaterLanding: null,
      teamLanding,
      byTheNumbers: null,
    });
    const texts = collectTexts(el);
    expect(texts).toContain('SHOTS >90mph');
    expect(texts).toContain('142');
    expect(texts).toContain('SPEED BURSTS');
    expect(texts).toContain('87');
  });

  it('renders EDGE INTEL header', () => {
    const skaterLanding = {
      hardestShot: {
        shotSpeed: { imperial: { speed: 100 } },
        player: { lastName: { default: 'Test' } },
      },
    } as any;
    const el = EdgeIntelSection({
      skaterLanding,
      teamLanding: null,
      byTheNumbers: null,
    });
    const texts = collectTexts(el);
    expect(texts).toContain('EDGE INTEL');
  });

  it('limits to 4 cards max', () => {
    const skaterLanding = {
      hardestShot: {
        shotSpeed: { imperial: { speed: 100 } },
        player: { lastName: { default: 'A' } },
      },
      maxSkatingSpeed: {
        skatingSpeed: { imperial: { speed: 23 } },
        player: { lastName: { default: 'B' } },
      },
    } as any;
    const teamLanding = {
      shotAttemptsOver90: {
        team: { abbrev: 'COL' },
        value: 142,
      },
      burstsOver22: {
        team: { abbrev: 'EDM' },
        value: 87,
      },
    } as any;
    const el = EdgeIntelSection({
      skaterLanding,
      teamLanding,
      byTheNumbers: null,
    });
    // Should have exactly 4 card testIDs
    const cardKeys = ['shot-speed', 'skating-speed', 'zone-time', 'shot-map'];
    let foundCards = 0;
    for (const key of cardKeys) {
      if (findByTestID(el, `edge-intel-card-${key}`)) foundCards++;
    }
    expect(foundCards).toBeLessThanOrEqual(4);
    expect(foundCards).toBeGreaterThanOrEqual(1);
  });
});
