const mockShare = {
  share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
};

jest.mock('react-native', () => ({
  Share: mockShare,
  Platform: { OS: 'ios' },
}));

// Mock react-native-view-shot as a virtual module (not installed yet)
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}), { virtual: true });

import { captureAndShareCard, formatShareText, shareGamePick } from '../shareCards';

const mockGame = {
  awayAbbrev: 'TOR',
  homeAbbrev: 'EDM',
  awayName: 'Toronto Maple Leafs',
  homeName: 'Edmonton Oilers',
};

const mockPrediction = {
  homeWinProb: 62,
  awayWinProb: 38,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── formatShareText ───

describe('formatShareText', () => {
  it('formats text with favored home team', () => {
    const text = formatShareText(mockGame, mockPrediction, 82);
    expect(text).toContain('PuckIQ Pick');
    expect(text).toContain('TOR vs EDM');
    expect(text).toContain('PICK: Edmonton Oilers (62%)');
    expect(text).toContain('Confidence: HIGH (82%)');
    expect(text).toContain('Get PuckIQ');
  });

  it('formats text with favored away team', () => {
    const text = formatShareText(
      mockGame,
      { homeWinProb: 35, awayWinProb: 65 },
      70,
    );
    expect(text).toContain('PICK: Toronto Maple Leafs (65%)');
    expect(text).toContain('Confidence: MEDIUM (70%)');
  });

  it('includes fantasy context when provided', () => {
    const text = formatShareText(mockGame, mockPrediction, 82, 'McDavid: Must-Start, Proj 4.2 pts');
    expect(text).toContain('McDavid: Must-Start, Proj 4.2 pts');
  });

  it('uses LOW confidence label for scores under 55', () => {
    const text = formatShareText(mockGame, mockPrediction, 40);
    expect(text).toContain('Confidence: LOW (40%)');
  });

  it('uses MEDIUM confidence label for scores 55-74', () => {
    const text = formatShareText(mockGame, mockPrediction, 60);
    expect(text).toContain('Confidence: MEDIUM (60%)');
  });
});

// ─── shareGamePick ───

describe('shareGamePick', () => {
  it('calls Share.share with formatted text', async () => {
    await shareGamePick(mockGame, mockPrediction, 82);
    expect(mockShare.share).toHaveBeenCalledWith({
      message: expect.stringContaining('PICK: Edmonton Oilers'),
    });
  });

  it('includes fantasy context in share text', async () => {
    await shareGamePick(mockGame, mockPrediction, 82, 'McDavid: Must-Start');
    expect(mockShare.share).toHaveBeenCalledWith({
      message: expect.stringContaining('McDavid: Must-Start'),
    });
  });
});

// ─── captureAndShareCard ───

describe('captureAndShareCard', () => {
  it('falls back to text share when viewRef.current is null', async () => {
    const viewRef = { current: null } as any;
    await captureAndShareCard(viewRef, 'fallback text');
    expect(mockShare.share).toHaveBeenCalledWith({ message: 'fallback text' });
  });

  it('does nothing when viewRef is null and no fallback', async () => {
    const viewRef = { current: null } as any;
    await captureAndShareCard(viewRef);
    expect(mockShare.share).not.toHaveBeenCalled();
  });

  it('captures and shares on iOS when view-shot works', async () => {
    const { captureRef } = require('react-native-view-shot');
    (captureRef as jest.Mock).mockResolvedValue('file:///tmp/card.png');

    const viewRef = { current: {} } as any;
    await captureAndShareCard(viewRef, 'fallback');

    expect(captureRef).toHaveBeenCalledWith(viewRef, {
      format: 'png',
      quality: 1,
    });
    expect(mockShare.share).toHaveBeenCalledWith({ url: 'file:///tmp/card.png' });
  });

  it('falls back to text share when captureRef throws', async () => {
    const { captureRef } = require('react-native-view-shot');
    (captureRef as jest.Mock).mockRejectedValue(new Error('capture failed'));

    const viewRef = { current: {} } as any;
    await captureAndShareCard(viewRef, 'fallback text');

    expect(mockShare.share).toHaveBeenCalledWith({ message: 'fallback text' });
  });
});
