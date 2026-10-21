/** The review ask and where "Not really" leads: the sheet, then the feedback form. */

import React from 'react';
import type { ReviewPrompt } from '../../hooks/useReviewPrompt';
import type { NightScore } from '../../services/fantasy/nightScore';
import FeedbackSheet from '../sheets/FeedbackSheet';
import { ReviewSheet } from './ReviewSheet';

export function ReviewAsk({ prompt, recap, isPro }: { prompt: ReviewPrompt; recap: NightScore | null; isPro: boolean }) {
  return (
    <>
      <ReviewSheet
        visible={prompt.visible}
        recap={recap}
        isPro={isPro}
        onYes={() => void prompt.enjoy()}
        onNotReally={prompt.notReally}
        onDismiss={prompt.dismiss}
      />
      <FeedbackSheet visible={prompt.feedbackOpen} onClose={prompt.closeFeedback} source="review_prompt" />
    </>
  );
}
