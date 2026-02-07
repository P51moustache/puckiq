/**
 * Tests for ShareableCard component and share helpers
 * Tests share text formatting, confidence label mapping, and callback behavior
 */

const mockShare = jest.fn().mockResolvedValue({ action: 'sharedAction' });

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Share: { share: mockShare },
  StyleSheet: { create: (styles: any) => styles },
  Alert: { alert: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    accent: '#60a5fa',
    text: '#e6eef8',
    subtext: '#98a6bf',
    card: '#1a2a4a',
  },
}));

jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: 'ConfidenceBadge',
}));

import { sharePick, shareStat } from '../ShareableCard';
import type { ShareablePickData, ShareableStatData } from '../ShareableCard';

const mockPickData: ShareablePickData = {
  predictedWinner: 'TOR',
  opponent: 'MTL',
  confidenceScore: 87,
  confidenceLabel: 'LOCK',
};

const mockStatData: ShareableStatData = {
  accuracy: 71,
  totalPicks: 45,
  period: 'this month',
};

describe('sharePick', () => {
  beforeEach(() => {
    mockShare.mockClear();
  });

  it('shares with LOCK label for 85+ confidence', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 90 });
    expect(mockShare).toHaveBeenCalledWith({
      message: '[LOCK] TOR over MTL — 90% confidence. PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('shares with STRONG label for 70-84 confidence', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 75 });
    expect(mockShare).toHaveBeenCalledWith({
      message: '[STRONG] TOR over MTL — 75% confidence. PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('shares with LEAN label for 55-69 confidence', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 60 });
    expect(mockShare).toHaveBeenCalledWith({
      message: '[LEAN] TOR over MTL — 60% confidence. PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('shares with TOSS-UP label for <55 confidence', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 50 });
    expect(mockShare).toHaveBeenCalledWith({
      message: '[TOSS-UP] TOR over MTL — 50% confidence. PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('includes h2hSummary in share text when provided', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 90, h2hSummary: 'TOR leads 3-1' });
    expect(mockShare).toHaveBeenCalledWith({
      message: '[LOCK] TOR over MTL — 90% confidence | TOR leads 3-1. PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('omits h2hSummary from share text when not provided', async () => {
    await sharePick({ ...mockPickData, confidenceScore: 90 });
    const msg = mockShare.mock.calls[0][0].message;
    expect(msg).not.toContain('|');
  });

  it('calls onShare callback after sharing', async () => {
    const onShare = jest.fn();
    await sharePick(mockPickData, onShare);
    expect(onShare).toHaveBeenCalled();
  });

  it('does not throw if share fails', async () => {
    mockShare.mockRejectedValueOnce(new Error('User cancelled'));
    await expect(sharePick(mockPickData)).resolves.not.toThrow();
  });
});

describe('shareStat', () => {
  beforeEach(() => {
    mockShare.mockClear();
  });

  it('shares stat text with accuracy and period', async () => {
    await shareStat(mockStatData);
    expect(mockShare).toHaveBeenCalledWith({
      message: 'My PuckIQ accuracy: 71% this month (45 picks). PuckIQ — Your Edge Before Every Pick',
    });
  });

  it('calls onShare callback after sharing', async () => {
    const onShare = jest.fn();
    await shareStat(mockStatData, onShare);
    expect(onShare).toHaveBeenCalled();
  });

  it('does not throw if share fails', async () => {
    mockShare.mockRejectedValueOnce(new Error('User cancelled'));
    await expect(shareStat(mockStatData)).resolves.not.toThrow();
  });
});
