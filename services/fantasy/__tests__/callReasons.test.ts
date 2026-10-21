import { lineupCallReasons, MAX_CALL_REASONS, type CallReasonInput } from '../callReasons';
import { buildGoalieForm, buildSkaterForm, type PlayerForm, type Trend } from '../form';
import type { GoalieOutlook } from '../goalieOutlook';
import type { TeamStrength } from '../../nhl/teams';
import type { PlayerGameDay } from '../weekPlan';
import { player } from './fixtures';

const DRAISAITL = 8477934;
const NYLANDER = 8477939;
const SHESTY = 8478048;
const players = [player(DRAISAITL, 'Leon Draisaitl', 'EDM', 'C'), player(NYLANDER, 'William Nylander', 'TOR', 'C'), player(SHESTY, 'Igor Shesterkin', 'NYR', 'G')];

function gameDay(opponent: string, isHome = true): PlayerGameDay {
  return { date: '2026-10-13', gameId: 1, opponent, isHome, startTimeUTC: '2026-10-13T23:00:00Z', state: 'FUT', offNight: false };
}

/** 32 teams, mid-table except the ones named. */
function strength(ranks: Record<string, Partial<Pick<TeamStrength, 'matchupRank' | 'offenseRank'>>> = {}): Map<string, TeamStrength> {
  const named = Object.keys(ranks);
  const map = new Map<string, TeamStrength>();
  for (let index = 0; index < 32; index += 1) {
    const team = named[index] ?? `T${index}`;
    map.set(team, { team, gamesPlayed: 5, goalsAgainstPerGame: 3, goalsForPerGame: 3, matchupRank: 16, offenseRank: 16, ...ranks[team] });
  }
  return map;
}

function skater(id: number, trend: Trend = 'steady'): PlayerForm {
  return { ...buildSkaterForm(id, {}), trend };
}

function input(extra: Partial<CallReasonInput> = {}): CallReasonInput {
  return {
    call: { startId: DRAISAITL, benchId: NYLANDER },
    players,
    games: { [DRAISAITL]: gameDay('MTL'), [NYLANDER]: gameDay('BOS', false) },
    values: new Map([[DRAISAITL, 3.24], [NYLANDER, 2.1]]),
    ...extra,
  };
}

it('explains a swap by matchup, form, the benched player, then the value gap', () => {
  const reasons = lineupCallReasons(input({
    strength: strength({ MTL: { matchupRank: 2 }, BOS: { matchupRank: 30 } }),
    forms: new Map([[DRAISAITL, skater(DRAISAITL, 'hot')], [NYLANDER, skater(NYLANDER)]]),
  }));
  expect(reasons).toEqual([
    { text: 'Soft matchup: MTL allows the 2nd-most goals', tone: 'good' },
    { text: 'Hot: above his season pace lately', tone: 'hot' },
    { text: 'Nylander has a tough matchup @ BOS', tone: 'bad' },
  ]);
  expect(reasons.length).toBe(MAX_CALL_REASONS);
});

it('falls back to the value gap when nothing else stands out', () => {
  expect(lineupCallReasons(input())).toEqual([{ text: '3.2 a game in your scoring, vs 2.1 for Nylander', tone: 'neutral' }]);
});

it('names a cold benched player when his matchup is ordinary', () => {
  const reasons = lineupCallReasons(input({ forms: new Map([[NYLANDER, skater(NYLANDER, 'cold')]]) }));
  expect(reasons.map((entry) => [entry.text, entry.tone])).toEqual([
    ['Nylander is cold lately', 'bad'],
    ['3.2 a game in your scoring, vs 2.1 for Nylander', 'neutral'],
  ]);
});

it('explains a plain start against the slot, without a bench player', () => {
  const reasons = lineupCallReasons(input({ call: { startId: DRAISAITL, benchId: null } }));
  expect(reasons).toEqual([{ text: '3.2 a game in your scoring, your best fit for this slot', tone: 'neutral' }]);
});

it('gives a goalie his start outlook and judges his matchup by the offense he faces', () => {
  const outlook: GoalieOutlook = { outlook: 'likely', chance: 0.7, reason: 'Rested: his team played last night without him', backToBack: 'second' };
  const reasons = lineupCallReasons(input({
    call: { startId: SHESTY, benchId: null },
    games: { [SHESTY]: gameDay('SJS') },
    values: new Map([[SHESTY, 4]]),
    forms: new Map([[SHESTY, { ...buildGoalieForm(SHESTY, {}), trend: 'steady' }]]),
    strength: strength({ SJS: { offenseRank: 31 } }),
    goalieOutlooks: new Map([[SHESTY, outlook]]),
  }));
  expect(reasons[0]).toEqual({ text: 'Soft matchup: SJS scores the 2nd-fewest goals', tone: 'good' });
  expect(reasons[1]).toEqual({ text: outlook.reason, tone: 'neutral' });
});

it('marks a tough matchup or a cold stretch for the starter as a caution', () => {
  const reasons = lineupCallReasons(input({
    strength: strength({ MTL: { matchupRank: 31 } }),
    forms: new Map([[DRAISAITL, skater(DRAISAITL, 'cold')]]),
  }));
  expect(reasons.slice(0, 2)).toEqual([
    { text: 'Tough matchup: MTL allows the 2nd-fewest goals', tone: 'bad' },
    { text: 'Cold: below his season pace lately', tone: 'bad' },
  ]);
});

it('leads with what backs the call and puts a caution about the starter after it', () => {
  const reasons = lineupCallReasons(input({
    call: { startId: DRAISAITL, benchId: null },
    strength: strength({ MTL: { matchupRank: 25 } }),
    forms: new Map([[DRAISAITL, skater(DRAISAITL, 'hot')]]),
  }));
  expect(reasons.map((entry) => entry.tone)).toEqual(['hot', 'bad', 'neutral']);
});

it('says nothing about a starter who is not on the roster', () => {
  expect(lineupCallReasons(input({ call: { startId: 1, benchId: null } }))).toEqual([]);
});
