/**
 * Snapshot a rendered card and open the iOS share sheet with the image.
 * Word of mouth is how fantasy apps spread — league chats are the target.
 */

import type { RefObject } from 'react';
import { Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const SHARE_TAGLINE = 'Set your fantasy hockey lineup with PuckIQ.';

export type ShareOutcome = 'shared' | 'dismissed' | 'failed';

export async function shareViewImage(view: RefObject<View | null>, message: string = SHARE_TAGLINE): Promise<ShareOutcome> {
  if (!view.current) return 'failed';
  let uri: string;
  try {
    uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch {
    return 'failed';
  }
  try {
    const result = await Share.share({ url: uri, message });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
