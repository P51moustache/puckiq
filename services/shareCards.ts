import { Share, Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Try to load react-native-view-shot dynamically.
 * Returns null if the package is not installed.
 */
function tryLoadViewShot(): { captureRef: (...args: any[]) => Promise<string> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-view-shot');
  } catch {
    return null;
  }
}

/**
 * Capture a React Native view as an image and share it.
 * Requires react-native-view-shot to be installed.
 * Falls back to text share if view-shot is not available.
 */
export async function captureAndShareCard(
  viewRef: RefObject<View | null>,
  fallbackText?: string,
): Promise<void> {
  try {
    const ViewShot = tryLoadViewShot();
    const captureRef = ViewShot?.captureRef;

    if (!captureRef || !viewRef.current) {
      console.warn('[SHARE CARD] captureRef or viewRef not available, using text fallback');
      if (fallbackText) {
        await Share.share({ message: fallbackText });
      }
      return;
    }

    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
    });

    if (Platform.OS === 'ios') {
      await Share.share({ url: uri });
    } else {
      await Share.share({ message: fallbackText ?? '', title: 'PuckIQ Pick' }, { dialogTitle: 'Share Pick' });
    }
  } catch (error) {
    console.warn('[SHARE CARD] Capture failed, falling back to text share:', error);
    if (fallbackText) {
      await Share.share({ message: fallbackText });
    }
  }
}

/**
 * Format a text-based share message for a game pick.
 */
export function formatShareText(
  game: { awayAbbrev: string; homeAbbrev: string; awayName: string; homeName: string },
  prediction: { homeWinProb: number; awayWinProb: number },
  confidenceScore: number,
  fantasyContext?: string,
): string {
  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const pickName = favoredIsHome ? game.homeName : game.awayName;
  const pickProb = favoredIsHome
    ? Math.round(prediction.homeWinProb)
    : Math.round(prediction.awayWinProb);

  const confidenceLabel =
    confidenceScore >= 75 ? 'HIGH' : confidenceScore >= 55 ? 'MEDIUM' : 'LOW';

  let text = `🏒 PuckIQ Pick: ${game.awayAbbrev} vs ${game.homeAbbrev}\n`;
  text += `\n🟢 PICK: ${pickName} (${pickProb}%)\n`;
  text += `Confidence: ${confidenceLabel} (${Math.round(confidenceScore)}%)\n`;

  if (fantasyContext) {
    text += `\n⚡ ${fantasyContext}\n`;
  }

  text += `\nGet PuckIQ for smart NHL picks!`;

  return text;
}

/**
 * Convenience function: share a game pick with text fallback.
 */
export async function shareGamePick(
  game: { awayAbbrev: string; homeAbbrev: string; awayName: string; homeName: string },
  prediction: { homeWinProb: number; awayWinProb: number },
  confidenceScore: number,
  fantasyContext?: string,
): Promise<void> {
  const text = formatShareText(game, prediction, confidenceScore, fantasyContext);
  await Share.share({ message: text });
}
