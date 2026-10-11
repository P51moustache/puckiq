import { lineupCoverageError } from '../dataQuality';
import { buildSkaterForm } from '../form';
import { game, player, week } from './fixtures';
const date = '2026-10-13';
const roster = [player(8478402, 'Connor McDavid', 'EDM', 'C')];
const schedule = week('2026-10-12', { [date]: [game(date, 'EDM', 'NJD')] });
it('withholds an actionable lineup when a playing player has no real stats', () => {
  expect(lineupCoverageError(roster, new Map([[8478402, buildSkaterForm(8478402, {})]]), schedule, date)).toContain('Connor McDavid');
});
it('does not require estimates for IR, scratches or players without a game on the requested date', () => {
  expect(lineupCoverageError([{ ...roster[0], injuredReserve: true }], new Map(), schedule, date)).toBeNull();
  expect(lineupCoverageError(roster, new Map(), schedule, date, new Set([8478402]))).toBeNull();
  expect(lineupCoverageError(roster, new Map(), schedule, '2026-10-14')).toBeNull();
});
