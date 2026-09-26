import { captureRef } from 'react-native-view-shot';
import { SHARE_TAGLINE, shareViewImage } from '../shareImage';

const mockShare = jest.fn();
jest.mock('react-native', () => ({
  Share: { share: (...args: unknown[]) => mockShare(...args), dismissedAction: 'dismissedAction', sharedAction: 'sharedAction' },
}));

const view = { current: {} } as any;

describe('shareViewImage', () => {
  beforeEach(() => {
    mockShare.mockReset();
    (captureRef as jest.Mock).mockReset();
  });

  it('snapshots the card to a PNG and shares it with the tagline', async () => {
    (captureRef as jest.Mock).mockResolvedValue('/tmp/card.png');
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await expect(shareViewImage(view)).resolves.toBe('shared');
    expect(captureRef).toHaveBeenCalledWith(view, { format: 'png', quality: 1, result: 'tmpfile' });
    expect(mockShare).toHaveBeenCalledWith({ url: '/tmp/card.png', message: SHARE_TAGLINE });
  });

  it('reports a dismissed sheet and failures without throwing', async () => {
    (captureRef as jest.Mock).mockResolvedValue('/tmp/card.png');
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    await expect(shareViewImage(view)).resolves.toBe('dismissed');

    (captureRef as jest.Mock).mockRejectedValue(new Error('no view'));
    await expect(shareViewImage(view)).resolves.toBe('failed');

    await expect(shareViewImage({ current: null })).resolves.toBe('failed');
  });
});
