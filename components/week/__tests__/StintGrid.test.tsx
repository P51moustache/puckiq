jest.mock('react-native', () => require('./support/mocks').reactNativeMock());
jest.mock('react-native-svg', () => require('./support/mocks').svgMock());
jest.mock('../../coach/PlayerAvatar', () => require('./support/mocks').playerAvatarMock());

import React from 'react';
import { teamTile } from '../../../constants/teamTiles';
import { colors } from '../../coach/ui';
import { JOIN_RADIUS, OFF_NIGHT_TINT, PAST_OPACITY } from '../gridMetrics';
import { StintGrid } from '../StintGrid';
import { scheduleRows } from '../stints';
import { mockWindow } from './support/mocks';
import { press, render, unmountAll } from './support/render';
import { allText, byTestId, flatStyle, oneByTestId, textOf, type Node } from './support/tree';
import { DRAISAITL, MATTHEWS, MCDAVID, ROSTER, nextWeekSchedule, planFor } from './support/weekFixtures';

const plan = planFor(ROSTER);
const rows = scheduleRows(ROSTER, plan);
const onOpenPlayer = jest.fn();

function renderGrid(detailed: boolean, weekPlan = plan) {
  return render(<StintGrid plan={weekPlan} rows={scheduleRows(ROSTER, weekPlan)} detailed={detailed} onOpenPlayer={onOpenPlayer} />);
}

const cell = (root: Node, playerId: number, date: string) => oneByTestId(root, `week-cell-${playerId}-${date}`);
const barIn = (node: Node) => {
  const bars = node.findAll((child: Node) => typeof child.type === 'string' && /^stint-/.test(child.props.testID ?? ''));
  return bars.length === 1 ? bars[0] : null;
};

afterEach(unmountAll);
beforeEach(() => {
  mockWindow.width = 390;
  jest.clearAllMocks();
});

describe('StintGrid — Pro', () => {
  it('fills a game that counts with the team colour and the opponent', () => {
    const bar = barIn(cell(renderGrid(true), MCDAVID, '2026-10-17'));
    expect(bar.props.testID).toBe('stint-count');
    const { tile, on } = teamTile('EDM');
    expect(flatStyle(bar.props.style)).toMatchObject({ backgroundColor: tile });
    const label = bar.findByType('Text');
    expect(textOf(label)).toBe('CGY');
    expect(flatStyle(label.props.style)).toMatchObject({ color: on });
  });

  it('hatches a game lost to the bench in an amber outline', () => {
    const bar = barIn(cell(renderGrid(true), DRAISAITL, '2026-10-17'));
    expect(bar.props.testID).toBe('stint-bench');
    expect(flatStyle(bar.props.style)).toMatchObject({ borderColor: colors.warn, backgroundColor: colors.card, overflow: 'hidden' });
    const pattern = bar.findByType('Pattern');
    expect(pattern.props.id).toBe(`hatch-${DRAISAITL}-2026-10-17`);
    expect(bar.findByType('Rect').props.fill).toBe(`url(#hatch-${DRAISAITL}-2026-10-17)`);
    expect(flatStyle(bar.findByType('Text').props.style)).toMatchObject({ color: colors.warn });
  });

  it('leaves a day without a game empty', () => {
    expect(barIn(cell(renderGrid(true), MCDAVID, '2026-10-14'))).toBeNull();
  });

  it('joins a back-to-back into one stint: square inner ends, round outer ends', () => {
    const root = renderGrid(true);
    const monday = flatStyle(barIn(cell(root, MCDAVID, '2026-10-12')).props.style);
    const tuesday = flatStyle(barIn(cell(root, MCDAVID, '2026-10-13')).props.style);
    const round = monday.height as number / 2;
    expect(monday).toMatchObject({ borderTopLeftRadius: round, borderTopRightRadius: JOIN_RADIUS });
    expect(tuesday).toMatchObject({ borderTopLeftRadius: JOIN_RADIUS, borderTopRightRadius: round });
    const saturday = flatStyle(barIn(cell(root, MCDAVID, '2026-10-17')).props.style);
    expect(saturday).toMatchObject({ borderTopLeftRadius: round, borderTopRightRadius: round });
  });

  it('fades days already played', () => {
    const root = renderGrid(true);
    expect(flatStyle(barIn(cell(root, MCDAVID, '2026-10-12')).props.style).opacity).toBe(PAST_OPACITY);
    expect(flatStyle(barIn(cell(root, MCDAVID, '2026-10-17')).props.style).opacity).toBeUndefined();
  });

  it('totals who plays and the empty slots per day, with a dash on a night without NHL games', () => {
    const root = renderGrid(true);
    expect(allText(oneByTestId(root, 'week-totals-playing'))).toBe('PLAYING | 3 | 2 | 2 | 1 | – | 4 | 1 | 13');
    const empty = oneByTestId(root, 'week-totals-empty');
    expect(allText(empty)).toBe('EMPTY SLOTS | 2 | 2 | 1 | 2 | – | 1 | 2 | 10');
    const amber = empty.findAll((node: Node) => node.type === 'Text' && flatStyle(node.props.style).color === colors.warn);
    expect(amber.map(textOf)).toEqual(['2', '2', '1', '2', '1', '2', '10']);
  });

  it('reads each row as games, games that count and bench losses', () => {
    const root = renderGrid(true);
    expect(oneByTestId(root, `week-row-${MATTHEWS}`).props.accessibilityLabel).toBe('Auston Matthews: 3 games, 1 counts, 2 on the bench');
    expect(oneByTestId(root, `week-row-${MCDAVID}`).props.accessibilityLabel).toBe('Connor McDavid: 3 games, 3 count');
  });
});

describe('StintGrid — free', () => {
  it('draws every game as a plain team-colour bar', () => {
    const bar = barIn(cell(renderGrid(false), DRAISAITL, '2026-10-17'));
    expect(bar.props.testID).toBe('stint-game');
    expect(flatStyle(bar.props.style)).toMatchObject({ backgroundColor: teamTile('EDM').tile });
    expect(bar.findAllByType('Svg')).toHaveLength(0);
  });

  it('totals who plays but not empty slots', () => {
    const root = renderGrid(false);
    expect(byTestId(root, 'week-totals-playing')).toHaveLength(1);
    expect(byTestId(root, 'week-totals-empty')).toHaveLength(0);
  });

  it('reads each row as games only', () => {
    expect(oneByTestId(renderGrid(false), `week-row-${MATTHEWS}`).props.accessibilityLabel).toBe('Auston Matthews: 3 games');
  });
});

describe('StintGrid — the week around the bars', () => {
  it('runs the now line down today’s column, capped on the first row', () => {
    const root = renderGrid(true);
    const lines = byTestId(root, 'week-now-line');
    expect(lines).toHaveLength(rows.length);
    for (const player of rows) {
      expect(byTestId(cell(root, player.playerId, '2026-10-14'), 'week-now-line')).toHaveLength(1);
    }
    expect(byTestId(root, 'week-now-cap')).toHaveLength(1);
    expect(byTestId(cell(root, rows[0].playerId, '2026-10-14'), 'week-now-cap')).toHaveLength(1);
    expect(flatStyle(lines[0].props.style)).toMatchObject({ backgroundColor: colors.accent, position: 'absolute' });
  });

  it('has no now line on a week that hasn’t started', () => {
    const root = renderGrid(true, planFor(ROSTER, nextWeekSchedule()));
    expect(byTestId(root, 'week-now-line')).toHaveLength(0);
    expect(byTestId(root, 'week-today')).toHaveLength(0);
  });

  it('tints off-night columns', () => {
    const root = renderGrid(true);
    expect(flatStyle(cell(root, MCDAVID, '2026-10-13').props.style).backgroundColor).toBe(OFF_NIGHT_TINT);
    expect(flatStyle(cell(root, MCDAVID, '2026-10-12').props.style).backgroundColor).toBeUndefined();
  });

  it('marks today in the header', () => {
    expect(allText(oneByTestId(renderGrid(true), 'week-today'))).toBe('WE | 14');
  });

  it('opens the player from his row', () => {
    press(oneByTestId(renderGrid(true), `week-row-${DRAISAITL}`));
    expect(onOpenPlayer).toHaveBeenCalledWith(DRAISAITL);
  });

  it('shows the opponent on phones and home/away with full names on iPad', () => {
    expect(textOf(barIn(cell(renderGrid(true), MCDAVID, '2026-10-12')).findByType('Text'))).toBe('TOR');
    unmountAll();
    mockWindow.width = 1032;
    const root = renderGrid(true);
    expect(textOf(barIn(cell(root, MCDAVID, '2026-10-12')).findByType('Text'))).toBe('@ TOR');
    expect(textOf(barIn(cell(root, MCDAVID, '2026-10-13')).findByType('Text'))).toBe('vs VAN');
    expect(byTestId(oneByTestId(root, `week-row-${MCDAVID}`), 'player-name').map(textOf)).toEqual(['Connor McDavid']);
  });
});
