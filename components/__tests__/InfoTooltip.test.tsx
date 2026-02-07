/**
 * Tests for InfoTooltip component.
 * Uses direct function-call rendering pattern (no @testing-library/react-native).
 */

jest.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: 'AnimatedView',
  },
  FadeIn: { duration: () => ({}) },
  SlideInDown: { duration: () => ({ springify: () => ({ damping: () => ({}) }) }) },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    card: '#192e5e',
    text: '#e6eef8',
    subtext: '#98a6bf',
    accent: '#60a5fa',
  },
}));

import React from 'react';
import InfoTooltip from '../InfoTooltip';
import type { GlossaryEntry } from '../../constants/glossary';

const mockEntry: GlossaryEntry = {
  term: 'LOCK',
  explanation: 'Our strongest call of the night.',
  category: 'confidence',
};

describe('InfoTooltip', () => {
  it('returns null when entry is null', () => {
    const result = InfoTooltip({ visible: true, entry: null, onClose: jest.fn() });
    expect(result).toBeNull();
  });

  it('renders a Modal when given a valid entry', () => {
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose: jest.fn() });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('Modal');
  });

  it('passes visible prop to Modal', () => {
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose: jest.fn() });
    expect(result?.props.visible).toBe(true);
  });

  it('renders the term text', () => {
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose: jest.fn() });
    // Walk the tree to find text content
    const json = JSON.stringify(result);
    expect(json).toContain('LOCK');
    expect(json).toContain('Our strongest call of the night.');
  });

  it('renders the Got it dismiss button text', () => {
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose: jest.fn() });
    const json = JSON.stringify(result);
    expect(json).toContain('Got it');
  });

  it('passes onClose to the Modal onRequestClose', () => {
    const onClose = jest.fn();
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose });
    expect(result?.props.onRequestClose).toBe(onClose);
  });

  it('renders category-appropriate icon name', () => {
    const result = InfoTooltip({ visible: true, entry: mockEntry, onClose: jest.fn() });
    const json = JSON.stringify(result);
    // 'confidence' category maps to 'shield-checkmark' icon
    expect(json).toContain('shield-checkmark');
  });

  it('renders fallback icon for unknown category', () => {
    const unknownEntry: GlossaryEntry = {
      term: 'TEST',
      explanation: 'Test entry',
      category: 'stat' as any,
    };
    const result = InfoTooltip({ visible: true, entry: unknownEntry, onClose: jest.fn() });
    const json = JSON.stringify(result);
    // 'stat' category maps to 'stats-chart'
    expect(json).toContain('stats-chart');
  });
});
