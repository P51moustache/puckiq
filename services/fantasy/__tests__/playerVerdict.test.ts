import { buildPlayerVerdict, formReason, matchupReason, MAX_REASONS, playerWeek, type VerdictInput } from '../playerVerdict';
import { buildGoalieForm, buildSkaterForm, type PlayerForm, type Trend } from '../form';
import { formatPuckDrop, weekDates, weekdayAbbrev } from '../../nhl/dates';
import type { GameLogRow } from '../../nhl/player';
import type { TeamStrength } from '../../nhl/teams';
import { busyNight, game } from './fixtures';
import type { NhlGame, WeekSchedule } from '../../nhl/schedule';

const MON = '2026-10-12';
const TUE = '2026-10-13';
const WED = '2026-10-14';
const PUCK_DROP = `${TUE}T23:00:00Z`;
const BEFORE_PUCK = Date.parse(`${TUE}T16:00:00Z`);
const AFTER_PUCK = Date.parse(`${TUE}T23:30:00Z`);
const TONIGHT = `Tonight · ${formatPuckDrop(PUCK_DROP)} vs MTL`;

function schedule(gamesByDate: Record<string, NhlGame[]>): WeekSchedule {
  return { monday: MON, days: weekDates(MON).map((date) => ({ date, dayAbbrev: weekdayAbbrev(date), games: gamesByDate[date] ?? [] })) };
}

/** EDM: Mon @ TOR (past), Tue vs MTL (tonight), Thu @ BOS (an off-night), Sat vs CGY. */
const EDM_WEEK = schedule({
  [MON]: [game(MON, 'EDM', 'TOR'), ...busyNight(MON)],
  [TUE]: [game(TUE, 'MTL', 'EDM'), ...busyNight(TUE)],
  '2026-10-15': [game('2026-10-15', 'EDM', 'BOS'), ...busyNight('2026-10-15', 2)],
  '2026-10-17': [game('2026-10-17', 'CGY', 'EDM'), ...busyNight('2026-10-17')],
});

/** 32 teams, mid-table except the ones named. */
function strength(ranks: Record<string, Partial<Pick<TeamStrength, 'matchupRank' | 'offenseRank'>>> = {}): Map<string, TeamStrength> {
  const map = new Map<string, TeamStrength>();
  for (let index = 0; index < 32; index += 1) {
    const team = index === 0 ? 'MTL' : index === 1 ? 'BOS' : `T${index}`;
    map.set(team, { team, gamesPlayed: 5, goalsAgainstPerGame: 3, goalsForPerGame: 3, matchupRank: 16, offenseRank: 16, ...ranks[team] });
  }
  return map;
}

function skaterForm(trend: Trend = 'steady'): PlayerForm {
  return { ...buildSkaterForm(8478402, {}), trend, value: 3 };
}

function goalieForm(trend: Trend = 'steady', startShare = 0.62): PlayerForm {
  return { ...buildGoalieForm(8479361, {}), trend, startShare, value: 3 };
}

function logRow(points: number, extra: Partial<GameLogRow> = {}): GameLogRow {
  return {
    gameId: 0, date: '2026-10-10', opponent: 'VAN', isHome: true, goals: 0, assists: points, points, ppp: 0, shots: 2,
    plusMinus: 0, pim: 0, toi: '18:00', started: false, decision: null, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutout: false,
    ...extra,
  };
}

function input(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    week: playerWeek(EDM_WEEK, 'EDM', TUE, BEFORE_PUCK),
    today: TUE,
    goalie: false,
    form: skaterForm(),
    log: [],
    isPro: false,
    ...overrides,
  };
}

describe('playerWeek', () => {
  it('lays out his team’s game each day, with past days and off-nights marked', () => {
    const week = playerWeek(EDM_WEEK, 'EDM', TUE, BEFORE_PUCK);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: MON, dayAbbrev: 'MON', past: true, game: { opponent: 'TOR', isHome: false } });
    expect(week[1]).toMatchObject({ date: TUE, past: false, game: { opponent: 'MTL', isHome: true, startTimeUTC: PUCK_DROP, started: false } });
    expect(week[2].game).toBeNull();
    expect(week[3]).toMatchObject({ offNight: true, game: { opponent: 'BOS', isHome: false } });
    expect(week[5].offNight).toBe(false);
  });

  it('counts tonight’s game as started by its state or once puck drop has passed, never a later one', () => {
    expect(playerWeek(EDM_WEEK, 'EDM', TUE, AFTER_PUCK)[1].game?.started).toBe(true);
    const live = schedule({ [TUE]: [game(TUE, 'MTL', 'EDM', { state: 'LIVE' })], '2026-10-15': [game('2026-10-15', 'EDM', 'BOS', { state: 'FINAL' })] });
    const week = playerWeek(live, 'EDM', TUE, BEFORE_PUCK);
    expect(week[1].game?.started).toBe(true);
    expect(week[3].game?.started).toBe(false);
  });

  it('is empty for a player with no NHL team', () => {
    expect(playerWeek(EDM_WEEK, '', TUE, BEFORE_PUCK)).toEqual([]);
  });
});

describe('buildPlayerVerdict', () => {
  it('has nothing to say without a week', () => {
    expect(buildPlayerVerdict(input({ week: [] }))).toBeNull();
  });

  it('tells a free user when he plays tonight and against whom', () => {
    expect(buildPlayerVerdict(input())).toEqual({
      kind: 'plays',
      tone: 'neutral',
      when: TONIGHT,
      call: 'Plays tonight',
      reasons: ['3 games left this week'],
    });
  });

  it('starts or sits my player by the best lineup for Pro', () => {
    const start = buildPlayerVerdict(input({ isPro: true, roster: { injuredReserve: false, slot: 'C' } }));
    expect(start).toMatchObject({ kind: 'start', tone: 'good', call: 'Start him', when: TONIGHT });
    expect(start?.reasons[0]).toBe('In your best lineup at C');

    const sit = buildPlayerVerdict(input({ isPro: true, roster: { injuredReserve: false, benched: true } }));
    expect(sit).toMatchObject({ kind: 'sit', tone: 'warn', call: 'Sit him' });
    expect(sit?.reasons[0]).toBe('His slots are full with higher-value players');
  });

  it('never reveals the lineup slot or bench call to a free user', () => {
    for (const roster of [{ injuredReserve: false, slot: 'C' as const }, { injuredReserve: false, benched: true }]) {
      const verdict = buildPlayerVerdict(input({ roster }));
      expect(verdict).toMatchObject({ kind: 'plays', call: 'Plays tonight' });
      expect(verdict?.reasons.join(' ')).not.toMatch(/lineup|slot/i);
    }
  });

  it('calls a confirmed NHL scratch for everyone, ahead of the lineup', () => {
    const status = { playerId: 8478402, signal: 'scratch' as const, confidence: 'confirmed' as const, note: 'On the NHL scratch list' };
    for (const isPro of [false, true]) {
      expect(buildPlayerVerdict(input({ isPro, roster: { injuredReserve: false, status, slot: 'C' } }))).toEqual({
        kind: 'scratched',
        tone: 'bad',
        when: TONIGHT,
        call: 'Scratched',
        reasons: ['On the NHL scratch list', 'Bench him in your league'],
      });
    }
  });

  it('asks for a check when only the news has injury language', () => {
    const dtd = { playerId: 8478402, signal: 'dtd' as const, confidence: 'likely' as const, note: 'Day-to-day language in today’s news' };
    expect(buildPlayerVerdict(input({ roster: { injuredReserve: false, status: dtd } }))).toMatchObject({
      kind: 'check',
      tone: 'warn',
      call: 'Check before lock',
      reasons: ['Day-to-day language in today’s news', 'Not confirmed by the NHL yet'],
    });
    const bare = { ...dtd, signal: 'out' as const, note: null };
    expect(buildPlayerVerdict(input({ roster: { injuredReserve: false, status: bare } }))?.reasons[0]).toBe('Injury news today');
  });

  it('says so when he is on my league’s IR', () => {
    expect(buildPlayerVerdict(input({ isPro: true, roster: { injuredReserve: true, slot: 'C' } }))).toMatchObject({
      kind: 'ir',
      call: 'On your IR',
      reasons: ['IR players don’t count toward your lineup'],
    });
  });

  it('gives a goalie’s start share to Pro only', () => {
    const pro = buildPlayerVerdict(input({ goalie: true, form: goalieForm(), isPro: true, roster: { injuredReserve: false, slot: 'G' } }));
    expect(pro?.reasons).toEqual(['In your best lineup at G', 'Starter not announced · he’s started 62% of games']);

    const free = buildPlayerVerdict(input({ goalie: true, form: goalieForm(), roster: { injuredReserve: false, slot: 'G' } }));
    expect(free).toMatchObject({ kind: 'plays', call: 'Team plays tonight' });
    expect(free?.reasons.join(' ')).not.toContain('%');
  });

  it('leads with the matchup, then form, and never says more than two things', () => {
    const verdict = buildPlayerVerdict(input({
      strength: strength({ MTL: { matchupRank: 3 } }),
      form: skaterForm('hot'),
      log: [logRow(2), logRow(1), logRow(0), logRow(3), logRow(1), logRow(4)],
    }));
    expect(verdict?.reasons).toEqual(['Soft matchup: MTL allows the 3rd-most goals', 'Hot: 7 pts in his last 5 games']);
    expect(verdict?.reasons.length).toBeLessThanOrEqual(MAX_REASONS);
  });

  it('looks ahead to his next game on a night off', () => {
    const verdict = buildPlayerVerdict(input({
      week: playerWeek(EDM_WEEK, 'EDM', WED, BEFORE_PUCK),
      today: WED,
      strength: strength({ BOS: { matchupRank: 30 } }),
    }));
    expect(verdict).toEqual({
      kind: 'off',
      tone: 'neutral',
      when: 'Next game · Tomorrow @ BOS',
      call: 'Off tonight',
      reasons: ['2 games left this week', 'Tough matchup: BOS allows the 3rd-fewest goals'],
    });
  });

  it('calls tonight locked once his game has started, and points at the next one', () => {
    const verdict = buildPlayerVerdict(input({ week: playerWeek(EDM_WEEK, 'EDM', TUE, AFTER_PUCK), isPro: true, roster: { injuredReserve: false, slot: 'C' } }));
    expect(verdict).toMatchObject({ kind: 'locked', call: 'Locked tonight', when: 'Next game · Thu @ BOS', reasons: ['2 games left this week'] });
  });

  it('says when there are no games left this week', () => {
    const sunday = '2026-10-18';
    const verdict = buildPlayerVerdict(input({ week: playerWeek(EDM_WEEK, 'EDM', sunday, BEFORE_PUCK), today: sunday, form: skaterForm('cold') }));
    expect(verdict).toEqual({ kind: 'none', tone: 'neutral', when: 'This week', call: 'No more games', reasons: ['Cold: below his season pace lately'] });
  });

  it('says plainly when his team has no games at all this week (preseason, a break)', () => {
    const quiet = playerWeek(schedule({}), 'EDM', TUE, BEFORE_PUCK);
    expect(buildPlayerVerdict(input({ week: quiet }))).toMatchObject({ kind: 'none', when: 'This week', call: 'No games', reasons: [] });
  });

  it('drops the puck-drop time when the NHL has not posted one', () => {
    const tbd = schedule({ [TUE]: [game(TUE, 'EDM', 'MTL', { startTimeUTC: null })] });
    expect(buildPlayerVerdict(input({ week: playerWeek(tbd, 'EDM', TUE, BEFORE_PUCK) }))?.when).toBe('Tonight · @ MTL');
  });
});

describe('matchupReason', () => {
  it('names how soft or tough the opponent is for a skater', () => {
    expect(matchupReason('MTL', false, strength({ MTL: { matchupRank: 1 } }))).toBe('Soft matchup: MTL allows the most goals');
    expect(matchupReason('MTL', false, strength({ MTL: { matchupRank: 31 } }))).toBe('Tough matchup: MTL allows the 2nd-fewest goals');
    expect(matchupReason('MTL', false, strength({ MTL: { matchupRank: 16 } }))).toBeNull();
  });

  it('judges a goalie by how much the opponent scores', () => {
    expect(matchupReason('MTL', true, strength({ MTL: { offenseRank: 2 } }))).toBe('Tough matchup: MTL scores the 2nd-most goals');
    expect(matchupReason('MTL', true, strength({ MTL: { offenseRank: 32 } }))).toBe('Soft matchup: MTL scores the fewest goals');
  });

  it('stays quiet without team strength', () => {
    expect(matchupReason('MTL', false, undefined)).toBeNull();
    expect(matchupReason('XYZ', false, strength())).toBeNull();
  });
});

describe('formReason', () => {
  it('counts points in his last games, singular when it is one', () => {
    expect(formReason(skaterForm(), [logRow(2), logRow(1)], false)).toBe('3 pts in his last 2 games');
    expect(formReason(skaterForm(), [logRow(1)], false)).toBe('1 pt in his last game');
    expect(formReason(skaterForm('unknown'), [], false)).toBeNull();
  });

  it('counts a goalie’s wins over his starts only', () => {
    const starts = [
      logRow(0, { started: true, decision: 'W' }),
      logRow(0, { started: false, decision: null }),
      logRow(0, { started: true, decision: 'L' }),
      logRow(0, { started: true, decision: 'W' }),
    ];
    expect(formReason(goalieForm('hot'), starts, true)).toBe('Hot: 2 wins in his last 3 starts');
  });

  it('falls back to the trend alone without a log', () => {
    expect(formReason(skaterForm('hot'), [], false)).toBe('Hot: above his season pace lately');
  });
});
