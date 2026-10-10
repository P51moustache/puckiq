import type { GoalieNight, GoalieNights } from '../../nhl/goalieStarts';
import type { PlayerForm } from '../form';
import {
  goalieOutlook,
  goalieRefs,
  nightOutlooks,
  outlookLabel,
  plannerGoalieInputs,
  startChance,
  type GoalieOutlookInput,
} from '../goalieOutlook';
import { player } from './fixtures';

const STARTER = 0.7;
const BACKUP = 0.3;
const regular = (startShare: number): GoalieOutlookInput => ({ startShare, backToBack: null });
const firstNight = (startShare: number): GoalieOutlookInput => ({ startShare, backToBack: 'first' });
const secondNight = (startShare: number, firstNightStarter?: GoalieOutlookInput['firstNightStarter']): GoalieOutlookInput => ({
  startShare,
  backToBack: 'second',
  firstNightStarter,
});

describe('goalieOutlook — a night with no back-to-back', () => {
  it('calls the usual starter likely, a bit above his season share', () => {
    const outlook = goalieOutlook(regular(STARTER));
    expect(outlook).toMatchObject({ outlook: 'likely', reason: 'Usual starter', backToBack: null });
    expect(outlook.chance).toBeGreaterThan(STARTER);
    expect(outlook.chance).toBeCloseTo(7 / 9);
  });

  it('calls the usual backup unlikely, a bit below his share', () => {
    const outlook = goalieOutlook(regular(BACKUP));
    expect(outlook).toMatchObject({ outlook: 'unlikely', reason: 'Usual backup' });
    expect(outlook.chance).toBeLessThan(BACKUP);
  });

  it('calls an even tandem a toss-up', () => {
    expect(goalieOutlook(regular(0.5))).toMatchObject({ outlook: 'split', chance: 0.5, reason: 'Shares the net with his partner' });
  });
});

describe('goalieOutlook — first night of a back-to-back', () => {
  it('puts a starter near half: he usually plays one of the two', () => {
    const outlook = goalieOutlook(firstNight(STARTER));
    expect(outlook).toMatchObject({ outlook: 'split', backToBack: 'first', reason: 'Back-to-back tomorrow too — starters usually play one' });
    expect(outlook.chance).toBeGreaterThan(0.5);
    expect(outlook.chance).toBeLessThan(goalieOutlook(regular(STARTER)).chance);
  });

  it('lifts a backup toward half', () => {
    const outlook = goalieOutlook(firstNight(BACKUP));
    expect(outlook).toMatchObject({ outlook: 'split', reason: 'Back-to-back tomorrow too — backups usually get one' });
    expect(outlook.chance).toBeGreaterThan(goalieOutlook(regular(BACKUP)).chance);
    expect(outlook.chance).toBeLessThan(0.5);
  });

  it('is a toss-up at best, however big his share', () => {
    const workhorse = goalieOutlook(firstNight(0.95));
    expect(workhorse.chance).toBeGreaterThanOrEqual(0.6);
    expect(workhorse.outlook).toBe('split');
  });

  it('barely moves a goalie who rarely starts', () => {
    const third = goalieOutlook(firstNight(0.05));
    expect(third.outlook).toBe('unlikely');
    expect(third.chance).toBeLessThan(0.15);
  });

  it('words the next night from tomorrow’s view', () => {
    expect(goalieOutlook({ ...firstNight(STARTER), night: 'tomorrow' }).reason).toBe('Back-to-back the next night too — starters usually play one');
  });
});

describe('goalieOutlook — second night of a back-to-back', () => {
  it('drops sharply when he started the first night', () => {
    const outlook = goalieOutlook(secondNight(STARTER, 'him'));
    expect(outlook).toMatchObject({
      outlook: 'unlikely',
      backToBack: 'second',
      reason: 'Started last night — backups usually get the second half of a back-to-back',
    });
    expect(outlook.chance).toBeCloseTo(0.175);
  });

  it('rises when his partner started the first night', () => {
    const starter = goalieOutlook(secondNight(STARTER, 'partner'));
    expect(starter).toMatchObject({ outlook: 'likely', reason: 'Back-to-back — his partner started last night' });
    expect(starter.chance).toBeGreaterThan(goalieOutlook(regular(STARTER)).chance);
    const backup = goalieOutlook(secondNight(BACKUP, 'partner'));
    expect(backup.outlook).toBe('likely');
    expect(backup.chance).toBeCloseTo(0.825);
  });

  it('tells a backup who started the first night that the starter usually gets the second', () => {
    expect(goalieOutlook(secondNight(BACKUP, 'him'))).toMatchObject({
      outlook: 'unlikely',
      reason: 'Started last night — the starter usually gets the second half of a back-to-back',
    });
  });

  it('stays near half when nobody knows who started the first night', () => {
    for (const unknown of [secondNight(STARTER), secondNight(STARTER, 'unknown')]) {
      expect(goalieOutlook(unknown)).toMatchObject({ outlook: 'split', reason: 'Back-to-back after last night — starters usually play one' });
      expect(startChance(unknown)).toBeCloseTo(startChance(firstNight(STARTER)));
    }
  });

  it('says “today” when the first night is today (tomorrow’s view)', () => {
    expect(goalieOutlook({ ...secondNight(STARTER, 'him'), night: 'tomorrow' }).reason).toBe(
      'Started today — backups usually get the second half of a back-to-back',
    );
    expect(goalieOutlook({ ...secondNight(BACKUP, 'partner'), night: 'tomorrow' }).reason).toBe('Back-to-back — his partner started today');
    expect(goalieOutlook({ ...secondNight(STARTER), night: 'tomorrow' }).reason).toBe('Back-to-back after today — starters usually play one');
  });

  it('ignores a first-night starter on a night that isn’t a second night', () => {
    expect(startChance({ ...regular(STARTER), firstNightStarter: 'him' })).toBeCloseTo(startChance(regular(STARTER)));
  });
});

describe('the start chance model', () => {
  const nights: Array<[string, (share: number) => GoalieOutlookInput, (share: number) => GoalieOutlookInput]> = [
    ['an ordinary night', regular, regular],
    ['a back-to-back night', firstNight, firstNight],
    ['the night after the starter played', (share) => secondNight(share, 'him'), (share) => secondNight(share, 'partner')],
    ['the night after the backup played', (share) => secondNight(share, 'partner'), (share) => secondNight(share, 'him')],
  ];

  it.each(nights)('gives a 70/30 tandem one start between them on %s', (_label, starterNight, backupNight) => {
    expect(startChance(starterNight(STARTER)) + startChance(backupNight(BACKUP))).toBeCloseTo(1);
  });

  it.each([0.3, 0.5, 0.7])('averages out to his season share (%p) over a season of nights', (share) => {
    // About 28 of 82 games are one half of a back-to-back.
    const average = (54 / 82) * startChance(regular(share)) + (28 / 82) * startChance(firstNight(share));
    expect(average).toBeCloseTo(share);
  });

  it('stays between 0 and 1 for odd shares', () => {
    for (const startShare of [-1, 0, 1, 2, Number.NaN]) {
      for (const input of [regular(startShare), firstNight(startShare), secondNight(startShare, 'him'), secondNight(startShare, 'partner')]) {
        const chance = startChance(input);
        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never says confirmed, and keeps numbers out of the words free users see', () => {
    const shares = [0.05, 0.3, 0.5, 0.7, 0.95];
    const starters = [undefined, 'him', 'partner', 'unknown'] as const;
    for (const startShare of shares) {
      for (const backToBack of [null, 'first', 'second'] as const) {
        for (const firstNightStarter of starters) {
          for (const night of ['tonight', 'tomorrow'] as const) {
            const outlook = goalieOutlook({ startShare, backToBack, firstNightStarter, night });
            expect(outlook.reason).not.toMatch(/confirm/i);
            expect(outlook.reason).not.toMatch(/\d/);
            // "B2B" is a word here, not a number.
            expect(outlookLabel(outlook).replace('B2B', '')).not.toMatch(/confirm|\d/i);
          }
        }
      }
    }
  });
});

describe('outlookLabel', () => {
  it('reads like a timing-screen tag', () => {
    expect(outlookLabel(goalieOutlook(secondNight(STARTER, 'him')))).toBe('B2B · BACKUP LIKELY');
    expect(outlookLabel(goalieOutlook(secondNight(BACKUP, 'partner')))).toBe('B2B · START LIKELY');
    expect(outlookLabel(goalieOutlook(firstNight(STARTER)))).toBe('B2B · TOSS-UP');
    expect(outlookLabel(goalieOutlook(regular(STARTER)))).toBe('START LIKELY');
    expect(outlookLabel(goalieOutlook(regular(BACKUP)))).toBe('BACKUP LIKELY');
  });
});

describe('goalieRefs', () => {
  it('keeps linked goalies off IR, once each, with their team', () => {
    const refs = goalieRefs([
      player(8476434, 'John Gibson', 'det', 'G'),
      player(8480193, 'Dmitri Tarasov', 'DET', 'G'),
      player(8480193, 'Dmitri Tarasov', 'DET', 'G'),
      player(8478048, 'Igor Shesterkin', 'NYR', 'G', { injuredReserve: true }),
      player(8478402, 'Connor McDavid', 'EDM', 'C'),
      player(1_756_000_000_000_001, 'Typed Goalie', 'BOS', 'G'),
      player(8479973, 'No Team', '', 'G'),
    ]);
    expect(refs).toEqual([
      { playerId: 8476434, team: 'DET' },
      { playerId: 8480193, team: 'DET' },
    ]);
  });
});

function form(playerId: number, startShare: number, extra: Partial<PlayerForm> = {}): PlayerForm {
  return {
    playerId,
    isGoalie: true,
    basis: 'current',
    seasonGp: 10,
    seasonRate: 4,
    recentGp: 0,
    recentRate: null,
    trend: 'unknown',
    value: 4 * startShare,
    startShare,
    season: null,
    recent: null,
    ...extra,
  };
}

describe('nightOutlooks', () => {
  const GIBSON = 8476434;
  const TARASOV = 8480193;
  const ROOKIE = 8484000;
  const SKATER = 8478402;
  const nights = new Map<number, GoalieNight>([
    [GIBSON, { backToBack: 'second', firstNightStarter: 'him' }],
    [TARASOV, { backToBack: 'second', firstNightStarter: 'partner' }],
    [ROOKIE, { backToBack: null, firstNightStarter: 'unknown' }],
    [SKATER, { backToBack: null, firstNightStarter: 'unknown' }],
  ]);
  const forms = new Map<number, PlayerForm>([
    [GIBSON, form(GIBSON, STARTER)],
    [TARASOV, form(TARASOV, BACKUP)],
    [ROOKIE, form(ROOKIE, 0.5, { basis: 'none' })],
    [SKATER, form(SKATER, 1, { isGoalie: false })],
  ]);

  it('gives each goalie his night’s outlook', () => {
    const outlooks = nightOutlooks(nights, forms);
    expect(outlooks.get(GIBSON)).toMatchObject({ outlook: 'unlikely', reason: 'Started last night — backups usually get the second half of a back-to-back' });
    expect(outlooks.get(TARASOV)).toMatchObject({ outlook: 'likely', reason: 'Back-to-back — his partner started last night' });
  });

  it('skips skaters, goalies without a form, and a placeholder share on an ordinary night', () => {
    const outlooks = nightOutlooks(new Map([...nights, [8470999, { backToBack: 'first', firstNightStarter: 'unknown' }]]), forms);
    expect([...outlooks.keys()].sort()).toEqual([GIBSON, TARASOV]);
  });

  it('still reads a back-to-back for a goalie without NHL numbers', () => {
    const rookieB2B = new Map<number, GoalieNight>([[ROOKIE, { backToBack: 'second', firstNightStarter: 'him' }]]);
    expect(nightOutlooks(rookieB2B, forms).get(ROOKIE)?.outlook).toBe('unlikely');
  });

  it('words the reasons for tomorrow’s view', () => {
    expect(nightOutlooks(nights, forms, 'tomorrow').get(GIBSON)?.reason).toBe('Started today — backups usually get the second half of a back-to-back');
  });
});

describe('plannerGoalieInputs', () => {
  const GIBSON = 8476434;
  const nights: GoalieNights = new Map([
    [GIBSON, new Map<string, GoalieNight>([
      ['2026-10-09', { backToBack: 'first', firstNightStarter: 'unknown' }],
      ['2026-10-10', { backToBack: 'second', firstNightStarter: 'him' }],
      ['2026-10-14', { backToBack: null, firstNightStarter: 'unknown' }],
    ])],
  ]);
  const shares = new Map([[GIBSON, STARTER]]);

  it('has nothing to add until the nights load', () => {
    expect(plannerGoalieInputs(null, shares)).toEqual({});
  });

  it('gives each of his nights its start chance and back-to-back role', () => {
    const { startChanceOn, backToBackOn } = plannerGoalieInputs(nights, shares);
    expect(startChanceOn!(GIBSON, '2026-10-10')).toBeCloseTo(0.175);
    expect(startChanceOn!(GIBSON, '2026-10-14')).toBeCloseTo(7 / 9);
    expect(backToBackOn!(GIBSON, '2026-10-09')).toBe('first');
    expect(backToBackOn!(GIBSON, '2026-10-14')).toBeUndefined();
  });

  it('leaves unknown goalies and nights to the flat share', () => {
    const { startChanceOn, backToBackOn } = plannerGoalieInputs(nights, new Map());
    expect(startChanceOn!(GIBSON, '2026-10-10')).toBeUndefined();
    expect(plannerGoalieInputs(nights, shares).startChanceOn!(GIBSON, '2026-10-11')).toBeUndefined();
    expect(backToBackOn!(8470999, '2026-10-10')).toBeUndefined();
  });
});
