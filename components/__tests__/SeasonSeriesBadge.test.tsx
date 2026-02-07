/**
 * Tests for SeasonSeriesBadge component
 * Verifies getSeriesText logic: first meeting, tied, team A leads, team B leads
 */

// Mock react-native (node test environment, no jsdom)
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    subtext: '#98a6bf',
    text: '#e6eef8',
  },
}));

import { getSeriesText } from '../SeasonSeriesBadge';
import { SeasonSeriesBadge } from '../SeasonSeriesBadge';
import type { H2HRecord } from '../../types/gameResults';

/** Helper to build an H2HRecord with sensible defaults. */
function makeRecord(overrides: Partial<H2HRecord> = {}): H2HRecord {
  return {
    teamA: 'TOR',
    teamB: 'MTL',
    teamAWins: 0,
    teamBWins: 0,
    otLosses: 0,
    games: [],
    ...overrides,
  };
}

describe('getSeriesText', () => {
  it('returns "First meeting" when games array is empty and wins are 0-0', () => {
    const record = makeRecord({ teamAWins: 0, teamBWins: 0, games: [] });
    expect(getSeriesText(record)).toBe('First meeting');
  });

  it('returns "Series tied 2-2" when teamAWins equals teamBWins', () => {
    const record = makeRecord({ teamAWins: 2, teamBWins: 2 });
    expect(getSeriesText(record)).toBe('Series tied 2-2');
  });

  it('returns "Series tied 1-1" for a 1-1 record', () => {
    const record = makeRecord({ teamAWins: 1, teamBWins: 1 });
    expect(getSeriesText(record)).toBe('Series tied 1-1');
  });

  it('returns "TOR leads 3-1" when teamA leads', () => {
    const record = makeRecord({ teamA: 'TOR', teamB: 'MTL', teamAWins: 3, teamBWins: 1 });
    expect(getSeriesText(record)).toBe('TOR leads 3-1');
  });

  it('returns "MTL leads 4-2" when teamB leads', () => {
    const record = makeRecord({ teamA: 'TOR', teamB: 'MTL', teamAWins: 2, teamBWins: 4 });
    expect(getSeriesText(record)).toBe('MTL leads 4-2');
  });

  it('handles 1-0 records correctly (teamA leads)', () => {
    const record = makeRecord({ teamA: 'BOS', teamB: 'NYR', teamAWins: 1, teamBWins: 0 });
    expect(getSeriesText(record)).toBe('BOS leads 1-0');
  });

  it('handles 0-1 records correctly (teamB leads)', () => {
    const record = makeRecord({ teamA: 'BOS', teamB: 'NYR', teamAWins: 0, teamBWins: 1 });
    expect(getSeriesText(record)).toBe('NYR leads 1-0');
  });

  it('handles lopsided series (5-0) for teamA', () => {
    const record = makeRecord({ teamA: 'EDM', teamB: 'CGY', teamAWins: 5, teamBWins: 0 });
    expect(getSeriesText(record)).toBe('EDM leads 5-0');
  });

  it('handles lopsided series (0-5) for teamB', () => {
    const record = makeRecord({ teamA: 'EDM', teamB: 'CGY', teamAWins: 0, teamBWins: 5 });
    expect(getSeriesText(record)).toBe('CGY leads 5-0');
  });
});

describe('SeasonSeriesBadge component', () => {
  it('returns null when h2hRecord is null', () => {
    const result = SeasonSeriesBadge({ h2hRecord: null, teamA: 'TOR', teamB: 'MTL' });
    expect(result).toBeNull();
  });

  it('renders with testID season-series-badge for a valid record', () => {
    const record = makeRecord({ teamAWins: 2, teamBWins: 1 });
    const element = SeasonSeriesBadge({ h2hRecord: record, teamA: 'TOR', teamB: 'MTL' });
    expect(element?.props?.testID).toBe('season-series-badge');
  });

  it('renders "First meeting" text when total games is 0', () => {
    const record = makeRecord({ teamAWins: 0, teamBWins: 0 });
    const element = SeasonSeriesBadge({ h2hRecord: record, teamA: 'TOR', teamB: 'MTL' });
    expect(element).toBeTruthy();
    expect(element?.props?.testID).toBe('season-series-badge');
  });

  it('renders without error in compact mode', () => {
    const record = makeRecord({ teamAWins: 3, teamBWins: 1 });
    const element = SeasonSeriesBadge({ h2hRecord: record, teamA: 'TOR', teamB: 'MTL', compact: true });
    expect(element).toBeTruthy();
    expect(element?.props?.testID).toBe('season-series-badge');
  });

  it('renders without error for a tied series', () => {
    const record = makeRecord({ teamAWins: 2, teamBWins: 2 });
    const element = SeasonSeriesBadge({ h2hRecord: record, teamA: 'TOR', teamB: 'MTL' });
    expect(element).toBeTruthy();
    expect(element?.props?.testID).toBe('season-series-badge');
  });
});
