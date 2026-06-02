/**
 * Tests for ClutchBadge component
 * Tests: all 3 states + null rendering
 */

import React from 'react';
import ClutchBadge from '../ClutchBadge';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

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

describe('ClutchBadge', () => {
  it('renders CLUTCH badge', () => {
    const el = ClutchBadge({ rating: 'CLUTCH' });
    expect(el?.props?.testID).toBe('clutch-badge');
    const texts = collectTexts(el);
    expect(texts).toContain('CLUTCH');
  });

  it('renders CLOSER badge', () => {
    const el = ClutchBadge({ rating: 'CLOSER' });
    const texts = collectTexts(el);
    expect(texts).toContain('CLOSER');
  });

  it('renders ICE COLD badge', () => {
    const el = ClutchBadge({ rating: 'ICE COLD' });
    const texts = collectTexts(el);
    expect(texts).toContain('ICE COLD');
  });

  it('returns null for null rating', () => {
    const el = ClutchBadge({ rating: null });
    expect(el).toBeNull();
  });

  it('renders compact mode', () => {
    const el = ClutchBadge({ rating: 'CLUTCH', compact: true });
    expect(el?.props?.testID).toBe('clutch-badge');
  });
});
