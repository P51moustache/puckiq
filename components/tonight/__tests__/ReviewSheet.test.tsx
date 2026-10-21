jest.mock('react-native', () => require('../../week/__tests__/support/mocks').reactNativeMock());
jest.mock('../../ui/TabBarBackground', () => ({ useBottomTabOverflow: () => 49 }));

import React from 'react';
import type { NightScore } from '../../../services/fantasy/nightScore';
import { render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId, flatStyle, oneByTestId } from '../../week/__tests__/support/tree';
import { ReviewSheet } from '../ReviewSheet';

const recap = {
  phase: 'final', totalPoints: 36, starterPoints: 31.5, benchPoints: 4.5, live: 0, final: 5, upcoming: 0, top: null,
  players: [{ playerId: 1, gameId: 1, state: 'final', points: 9.5, role: 'starter', slot: 'C', bigNight: null }],
  hindsight: { best: 33.5, captured: 31.5, share: 0.94 }, leadGame: null,
} as unknown as NightScore;

afterEach(() => unmountAll());

const sheet = (props: Partial<React.ComponentProps<typeof ReviewSheet>> = {}) => render(
  <ReviewSheet visible recap={recap} isPro onYes={jest.fn()} onNotReally={jest.fn()} onDismiss={jest.fn()} {...props} />,
);

describe('ReviewSheet', () => {
  it('renders nothing until it is asked', () => {
    expect(byTestId(sheet({ visible: false }), 'tonight-review-prompt')).toHaveLength(0);
  });

  it('stamps the night, then asks with two answers above the tab bar', () => {
    const root = sheet();
    const text = allText(root);
    expect(text).toContain('94% OF BEST LINEUP');
    expect(text).toContain('31.5 PTS');
    expect(text).toContain('Good night for your lineup.\nEnjoying PuckIQ?');
    expect(text).toContain('Tell us either way.');
    expect(flatStyle(oneByTestId(root, 'tonight-review-prompt').props.style).paddingBottom).toBe(49 + 16);
  });

  it('never promises a review dialog', () => {
    expect(allText(sheet()).toLowerCase()).not.toMatch(/rate|review|stars?\b|app store/);
  });

  it('keeps the Pro-only share off a free user\'s sheet', () => {
    const text = allText(sheet({ isPro: false }));
    expect(text).not.toContain('OF BEST LINEUP');
    expect(text).toContain('36.0 PTS');
  });

  it('sends each answer to its handler, and the backdrop closes it', () => {
    const onYes = jest.fn();
    const onNotReally = jest.fn();
    const onDismiss = jest.fn();
    const root = sheet({ onYes, onNotReally, onDismiss });
    oneByTestId(root, 'review-prompt-yes').props.onPress();
    oneByTestId(root, 'review-prompt-no').props.onPress();
    oneByTestId(root, 'tonight-review-backdrop').props.onPress();
    expect([onYes, onNotReally, onDismiss].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
