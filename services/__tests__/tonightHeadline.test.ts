import { buildTonightHeadline, isTonightProblem } from '../tonightHeadline';
import type { TonightPlayerStatus } from '../../types/fantasy';

function row(overrides: Partial<TonightPlayerStatus>): TonightPlayerStatus {
  return {
    playerId: 1,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    opponentAbbrev: 'CGY',
    isHome: true,
    gameId: 1,
    startTimeUTC: '2026-09-29T23:00:00Z',
    gameState: 'FUT',
    injurySignal: 'ok',
    injuryNote: null,
    confidence: 'unknown',
    recommendation: 'START',
    reason: "In tonight's lineup",
    ...overrides,
  };
}

describe('buildTonightHeadline', () => {
  it('reads like your-guys / problem / move, not a briefing', () => {
    const headline = buildTonightHeadline([
      row({ playerId: 1, playerName: 'Connor McDavid' }),
      row({ playerId: 2, playerName: 'Leon Draisaitl' }),
      row({
        playerId: 3,
        playerName: 'Scratch Winger',
        injurySignal: 'scratch',
        confidence: 'confirmed',
        recommendation: 'SIT',
        reason: 'Scratched tonight',
      }),
    ]);
    expect(headline.playing).toBe(3);
    expect(headline.problems).toBe(1);
    expect(headline.moves).toBeGreaterThanOrEqual(1);
    expect(headline.text).toBe('3 of YOUR guys play tonight. 1 problem. 2 moves.');
  });

  it('treats an unconfirmed starting goalie as a problem', () => {
    const goalie = row({
      playerId: 9,
      playerName: 'Stuart Skinner',
      position: 'G',
      recommendation: 'FLEX',
      reason: 'Starter not confirmed',
    });
    expect(isTonightProblem(goalie)).toBe(true);
    expect(buildTonightHeadline([goalie]).text).toMatch(/1 problem/);
  });

  it('does not treat a healthy off-night as a problem', () => {
    const off = row({
      opponentAbbrev: null,
      recommendation: 'SIT',
      reason: 'No game tonight',
    });
    expect(isTonightProblem(off)).toBe(false);
    expect(buildTonightHeadline([off]).text).toBe('0 of YOUR guys play tonight. 0 problems. 0 moves.');
  });
});
