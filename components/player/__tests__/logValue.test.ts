import { logRowValue } from '../logValue';
import { DEFAULT_SCORING } from '../../../services/fantasy/scoring';
import type { GameLogRow } from '../../../services/nhl/player';

const row: GameLogRow = {
  gameId: 1, date: '2026-10-10', opponent: 'VAN', isHome: true, goals: 1, assists: 2, points: 3, ppp: 1, shots: 4, plusMinus: 2,
  pim: 0, toi: '20:00', started: true, decision: 'W', saves: 30, shotsAgainst: 32, goalsAgainst: 2, shutout: false,
};

describe('logRowValue', () => {
  it('scores a skater’s game with the league’s weights', () => {
    // 1 G × 3 + 2 A × 2 + 1 PPP × 1 + 4 SOG × 0.5 (+/- is worth 0 by default)
    expect(logRowValue(row, false, DEFAULT_SCORING)).toBe(10);
  });

  it('scores a goalie’s game from the win, saves, goals against and shutout', () => {
    // W × 5 + 30 SV × 0.2 + 2 GA × -1
    expect(logRowValue(row, true, DEFAULT_SCORING)).toBe(9);
    expect(logRowValue({ ...row, decision: 'L', goalsAgainst: 0, shutout: true }, true, DEFAULT_SCORING)).toBe(9);
  });
});
