import {
  assessMatchup,
  estimateRemainingSeason,
  remainingTeamGames,
} from '../playerOutlook';
import { buildGoalieForm, buildSkaterForm } from '../form';
import type { GoalieLine, SkaterLine } from '../../nhl/stats';
import type { TeamStrength } from '../../nhl/teams';
import { game } from './fixtures';
const skater = (gp: number, goals: number, assists: number): SkaterLine => ({
  playerId: 8478402,
  name: 'Test',
  position: 'C',
  team: 'EDM',
  gp,
  goals,
  assists,
  points: goals + assists,
  ppp: 0,
  shots: 0,
  hits: 0,
  blocks: 0,
  plusMinus: 0,
  toiPerGame: 0,
});
const goalie: GoalieLine = {
  playerId: 8478048,
  name: 'Test',
  team: 'NYR',
  gp: 40,
  gs: 40,
  wins: 20,
  saves: 1200,
  shotsAgainst: 1300,
  goalsAgainst: 100,
  shutouts: 4,
  savePct: 1200 / 1300,
  gaa: 2.5,
};
const opponent: TeamStrength = {
  team: 'MTL',
  gamesPlayed: 12,
  goalsAgainstPerGame: 4,
  goalsForPerGame: 2,
  matchupRank: 1,
  offenseRank: 32,
};
describe('player outlooks', () => {
  it('uses actual remaining schedule games rather than a hard-coded full season', () => {
    const games = [
      game('2026-10-12', 'EDM', 'LAK'),
      game('2026-10-13', 'EDM', 'LAK', { state: 'LIVE' }),
      game('2026-10-14', 'EDM', 'LAK'),
    ];
    expect(
      remainingTeamGames(
        games,
        '2026-10-13',
        Date.parse('2026-10-13T22:00:00Z'),
      ).map((g) => g.date),
    ).toEqual(['2026-10-14']);
    expect(
      estimateRemainingSeason(
        buildSkaterForm(8478402, { current: skater(20, 10, 20) }),
        8,
      )?.metrics,
    ).toEqual([
      { label: 'Goals', value: 4 },
      { label: 'Assists', value: 8 },
      { label: 'Points', value: 12 },
    ]);
  });
  it('stabilizes early season projections with the previous-season baseline', () => {
    const form = buildSkaterForm(8478402, {
      current: skater(2, 4, 6),
      previous: skater(80, 40, 80),
    });
    expect(estimateRemainingSeason(form, 60)?.metrics).toEqual([
      { label: 'Goals', value: 45 },
      { label: 'Assists', value: 80 },
      { label: 'Points', value: 125 },
    ]);
    expect(estimateRemainingSeason(form, 60)?.basis).toContain('prior-season');
  });
  it('blends recent form only after three games and keeps points equal to goals plus assists', () => {
    const two = estimateRemainingSeason(
      buildSkaterForm(8478402, {
        current: skater(20, 10, 20),
        recent: skater(2, 8, 8),
      }),
      10,
    )!;
    expect(two.metrics[0].value).toBe(5);
    const three = estimateRemainingSeason(
      buildSkaterForm(8478402, {
        current: skater(20, 10, 20),
        recent: skater(3, 3, 6),
      }),
      10,
    )!;
    expect(three.metrics[2].value).toBe(
      three.metrics[0].value + three.metrics[1].value,
    );
  });
  it('adjusts goalie volume for start share and does not claim confirmed starts', () => {
    const form = buildGoalieForm(8478048, {
      current: goalie,
      teamGamesPlayed: 80,
    });
    const estimate = estimateRemainingSeason(form, 10)!;
    expect(estimate.games).toBe(5);
    expect(estimate.metrics).toEqual([
      { label: 'Wins', value: 3 },
      { label: 'Saves', value: 150 },
      { label: 'Shutouts', value: 1 },
    ]);
    expect(estimate.basis).toContain('start share');
  });
  it('returns no estimate when stats or remaining games are missing', () => {
    expect(estimateRemainingSeason(null, 20)).toBeNull();
    expect(
      estimateRemainingSeason(buildSkaterForm(8478402, {}), 20),
    ).toBeNull();
    expect(
      estimateRemainingSeason(
        buildSkaterForm(8478402, { current: skater(20, 10, 10) }),
        0,
      ),
    ).toBeNull();
  });
  it('rates weak defenses for skaters and weak offenses for goalies, keeping missing data unknown', () => {
    expect(assessMatchup(opponent, false).stars).toBe(5);
    expect(assessMatchup(opponent, true).stars).toBe(5);
    expect(assessMatchup({ ...opponent, offenseRank: 1 }, true).stars).toBe(1);
    expect(assessMatchup(undefined, false).stars).toBeNull();
    expect(
      assessMatchup({ ...opponent, matchupRank: 0 }, false).stars,
    ).toBeNull();
  });
});
