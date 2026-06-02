/**
 * Tests for ConfidenceBadge component
 * Verifies tier boundaries: LOCK (70+), STRONG (45-69), LEAN (20-44), TOSS-UP (<20)
 */

// We test the getTier logic by importing the component module and verifying
// the label text rendered for each confidence range.

// Mock react-native
import React from 'react';
import { ConfidenceBadge } from '../ConfidenceBadge';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

// Simple render helper that extracts text content from JSX
function getRenderedLabel(confidence: number, size?: 'sm' | 'md' | 'lg'): string {
  const element = ConfidenceBadge({ confidence, size });
  // The component returns View > Text with the label as children
  const textElement = element?.props?.children;
  return textElement?.props?.children || '';
}

describe('ConfidenceBadge', () => {
  describe('tier boundaries', () => {
    it('returns TOSS-UP for confidence 0', () => {
      expect(getRenderedLabel(0)).toBe('TOSS-UP');
    });

    it('returns TOSS-UP for confidence 19', () => {
      expect(getRenderedLabel(19)).toBe('TOSS-UP');
    });

    it('returns LEAN for confidence 20 (boundary)', () => {
      expect(getRenderedLabel(20)).toBe('LEAN');
    });

    it('returns LEAN for confidence 44', () => {
      expect(getRenderedLabel(44)).toBe('LEAN');
    });

    it('returns STRONG for confidence 45 (boundary)', () => {
      expect(getRenderedLabel(45)).toBe('STRONG');
    });

    it('returns STRONG for confidence 69', () => {
      expect(getRenderedLabel(69)).toBe('STRONG');
    });

    it('returns LOCK for confidence 70 (boundary)', () => {
      expect(getRenderedLabel(70)).toBe('LOCK');
    });

    it('returns LOCK for confidence 100', () => {
      expect(getRenderedLabel(100)).toBe('LOCK');
    });
  });

  describe('sizes', () => {
    it('renders with sm size without error', () => {
      const element = ConfidenceBadge({ confidence: 70, size: 'sm' });
      expect(element).toBeTruthy();
    });

    it('renders with md size (default) without error', () => {
      const element = ConfidenceBadge({ confidence: 70 });
      expect(element).toBeTruthy();
    });

    it('renders with lg size without error', () => {
      const element = ConfidenceBadge({ confidence: 70, size: 'lg' });
      expect(element).toBeTruthy();
    });
  });

  describe('testID', () => {
    it('has testID confidence-badge', () => {
      const element = ConfidenceBadge({ confidence: 70 });
      expect(element?.props?.testID).toBe('confidence-badge');
    });
  });
});
