jest.mock('react-native', () =>
  require('../../week/__tests__/support/mocks').reactNativeMock(),
);
import React from 'react';
import { Pressable } from 'react-native';
import type { GameLogRow } from '../../../services/nhl/player';
import { DEFAULT_SCORING } from '../../../services/fantasy/scoring';
import { PerformanceChart } from '../PerformanceChart';
import { render, press, unmountAll } from '../../week/__tests__/support/render';
import { allText, oneByTestId } from '../../week/__tests__/support/tree';
const row: GameLogRow = {
  gameId: 1,
  date: '2026-10-10',
  opponent: 'LAK',
  isHome: true,
  goals: 2,
  assists: 1,
  points: 3,
  ppp: 0,
  shots: 4,
  plusMinus: 0,
  pim: 0,
  toi: '20:00',
  started: true,
  decision: null,
  saves: 0,
  shotsAgainst: 0,
  goalsAgainst: 0,
  shutout: false,
};
afterEach(unmountAll);
it('changes the actual plotted metric and shows the selected game value', () => {
  const root = render(
    <PerformanceChart
      log={[row]}
      goalie={false}
      scoring={DEFAULT_SCORING}
      isPro
    />,
  );
  expect(
    oneByTestId(root, 'performance-bar-0').props.accessibilityLabel,
  ).toContain('3 Points');
  press(oneByTestId(root, 'performance-goals'));
  expect(
    oneByTestId(root, 'performance-bar-0').props.accessibilityLabel,
  ).toContain('2 Goals');
  press(oneByTestId(root, 'performance-bar-0'));
  expect(allText(root)).toContain('Oct 10 vs LAK · 2 Goals');
});
it('distinguishes an undefined goalie save percentage from a zero save percentage', () => {
  const root = render(
    <PerformanceChart log={[row]} goalie scoring={DEFAULT_SCORING} isPro />,
  );
  press(oneByTestId(root, 'performance-savePct'));
  expect(
    oneByTestId(root, 'performance-bar-0').props.accessibilityLabel,
  ).toContain('— SV%');
  expect(allText(root)).toContain('no shots faced');
});
it('discloses missing scoring categories only for fantasy values', () => {
  const root = render(
    <PerformanceChart
      log={[row]}
      goalie={false}
      scoring={{ ...DEFAULT_SCORING, hits: 1, blocks: 1 }}
      isPro
    />,
  );
  expect(allText(root)).not.toContain('excludes hits and blocks');
  press(oneByTestId(root, 'performance-value'));
  expect(allText(root)).toContain('excludes hits and blocks');
});
it('keeps a selected game stable and safely clears it when the visible history shrinks', () => {
  function Probe() {
    const [mode, setMode] = React.useState<'pro' | 'free' | 'short'>('pro');
    const log = Array.from({ length: mode === 'short' ? 1 : 10 }, (_, index) => ({ ...row, gameId: index + 1 }));
    return <><PerformanceChart log={log} goalie={false} scoring={DEFAULT_SCORING} isPro={mode === 'pro'} />
      <Pressable testID="free" onPress={() => setMode('free')} />
      <Pressable testID="short" onPress={() => setMode('short')} /></>;
  }
  const root = render(<Probe />);
  press(oneByTestId(root, 'performance-bar-9'));
  press(oneByTestId(root, 'free'));
  expect(allText(root)).toContain('Oct 10 vs LAK');
  press(oneByTestId(root, 'performance-bar-0'));
  press(oneByTestId(root, 'short'));
  expect(allText(root)).toContain('Last 1 games');
});
