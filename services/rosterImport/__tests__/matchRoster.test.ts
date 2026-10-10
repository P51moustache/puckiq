import type { RosterPlayer } from '../../nhl/rosters';
import { ACTIVE_NHL_TEAMS, mapRoster } from '../../nhl/rosters';
import { buildPlayerIndex, matchRosterRows, mergeSearchMatches, nameFromRow, rowsFromPastedText } from '../matchRoster';
import { normalizeName, teamsInRow } from '../normalize';
import { rowsFromOcr, type OcrLine } from '../ocrRows';

let nextId = 8470000;
const p = (first: string, last: string, team: string, position: string): RosterPlayer => {
  nextId += 1;
  return { playerId: nextId, firstName: first, lastName: last, team, position };
};

const MCDAVID = p('Connor', 'McDavid', 'EDM', 'C');
const DRAISAITL = p('Leon', 'Draisaitl', 'EDM', 'C');
const HYMAN = p('Zach', 'Hyman', 'EDM', 'L');
const JACK = p('Jack', 'Hughes', 'NJD', 'C');
const LUKE = p('Luke', 'Hughes', 'NJD', 'D');
const QUINN = p('Quinn', 'Hughes', 'MIN', 'D');
const KYLE_CONNOR = p('Kyle', 'Connor', 'WPG', 'L');
const BEDARD = p('Connor', 'Bedard', 'CHI', 'C');
const MILLER = p('J.T.', 'Miller', 'NYR', 'C');
const DUBOIS = p('Pierre-Luc', 'Dubois', 'WSH', 'C');
const LAFRENIERE = p('Alexis', 'Lafrenière', 'NYR', 'L');
const OREILLY = p('Ryan', "O'Reilly", 'NSH', 'C');
const JVR = p('James', 'van Riemsdyk', 'CBJ', 'L');
const SHESTERKIN = p('Igor', 'Shesterkin', 'NYR', 'G');
const IAN_COLE = p('Ian', 'Cole', 'UTA', 'D');
const CAUFIELD = p('Cole', 'Caufield', 'MTL', 'R');

const index = buildPlayerIndex([
  MCDAVID, DRAISAITL, HYMAN, JACK, LUKE, QUINN, KYLE_CONNOR, BEDARD, MILLER, DUBOIS, LAFRENIERE, OREILLY, JVR, SHESTERKIN, IAN_COLE, CAUFIELD,
]);
const ids = (rows: string[]) => matchRosterRows(rows, index).matched.map((m) => m.player.playerId).sort();
const sorted = (...players: RosterPlayer[]) => players.map((player) => player.playerId).sort();

describe('normalizeName', () => {
  it('folds accents, initials, apostrophes and hyphens', () => {
    expect(normalizeName('Alexis Lafrenière')).toBe('alexis lafreniere');
    expect(normalizeName('J.T. Miller')).toBe('jt miller');
    expect(normalizeName("Ryan O'Reilly")).toBe('ryan oreilly');
    expect(normalizeName('Pierre-Luc Dubois')).toBe('pierre luc dubois');
  });
});

describe('teamsInRow', () => {
  it('reads the player’s own team but not the opponent', () => {
    expect([...teamsInRow('Edm - C  @SJ 7:00 pm')]).toEqual(['EDM']);
    expect([...teamsInRow('NJ C vs TOR')]).toEqual(['NJD']);
    expect([...teamsInRow('James van Riemsdyk')]).toEqual([]);
  });
});

describe('matchRosterRows', () => {
  it('reads a Yahoo-style roster: slot, name, then team and position on the next line', () => {
    const rows = ['C', 'Connor McDavid', 'Edm - C', '@SJ 7:00 pm', 'LW', 'Kyle Connor', 'Wpg - LW', 'BN', 'Jack Hughes', 'NJ - C', 'D', 'Quinn Hughes', 'Min - D'];
    const result = matchRosterRows(rows, index);
    expect(result.matched.map((m) => m.player.playerId).sort()).toEqual(sorted(MCDAVID, KYLE_CONNOR, JACK, QUINN));
    expect(result.matched.every((m) => m.confidence === 'exact')).toBe(true);
    expect(result.ambiguous).toEqual([]);
  });

  it('reads an ESPN-style roster with initials and settles same-name players by initial', () => {
    expect(ids(['C. McDavid EDM C', 'J. Hughes NJ C', 'Q. Hughes MIN D', 'L. Hughes NJ D', 'J.T. Miller NYR C'])).toEqual(
      sorted(MCDAVID, JACK, QUINN, LUKE, MILLER),
    );
  });

  it('never reads a slot label as a first initial', () => {
    expect(ids(['C Connor McDavid', 'LW Kyle Connor', 'C Cole Caufield MTL', 'D Ian Cole'])).toEqual(sorted(MCDAVID, KYLE_CONNOR, CAUFIELD, IAN_COLE));
  });

  it('handles accents, apostrophes, hyphens and two-word last names', () => {
    expect(ids(['Alexis Lafreniere', "Ryan O’Reilly", 'Pierre-Luc Dubois', 'James van Riemsdyk'])).toEqual(sorted(LAFRENIERE, OREILLY, DUBOIS, JVR));
  });

  it('recovers names the app cut short and one-letter reading slips', () => {
    const result = matchRosterRows(['Connor McDav…', 'Igor Shesterkln'], index);
    expect(result.matched.map((m) => [m.player.playerId, m.confidence])).toEqual([[MCDAVID.playerId, 'likely'], [SHESTERKIN.playerId, 'likely']]);
  });

  it('asks instead of guessing when a last name fits several players', () => {
    const alone = matchRosterRows(['Hughes'], index);
    expect(alone.matched).toEqual([]);
    expect(alone.ambiguous).toHaveLength(1);
    expect(alone.ambiguous[0].options.map((o) => o.playerId).sort()).toEqual(sorted(JACK, LUKE, QUINN));

    const withTeam = matchRosterRows(['Hughes NJ'], index);
    expect(withTeam.ambiguous[0].options.map((o) => o.playerId).sort()).toEqual(sorted(JACK, LUKE));

    expect(ids(['Hughes MIN'])).toEqual(sorted(QUINN));
  });

  it('drops the question once the same player is matched outright elsewhere', () => {
    const result = matchRosterRows(['Hughes NJ', 'Jack Hughes'], index);
    expect(result.ambiguous).toEqual([]);
    expect(result.matched.map((m) => m.player.playerId)).toEqual([JACK.playerId]);
  });

  it('lists each player once, keeping the exact reading', () => {
    const result = matchRosterRows(['McDavid', 'Connor McDavid'], index);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].confidence).toBe('exact');
  });

  it('reports name-like rows it could not match, but not app labels', () => {
    const result = matchRosterRows(['My Team', 'Connor McDavid', 'Set Lineup', 'Bobby Unknown', 'Free Agents', 'Jack Hughes'], index);
    expect(result.unmatched).toEqual(['Bobby Unknown']);
    expect(result.leftovers).toEqual(['Bobby Unknown']);
  });

  it('counts only names inside the roster list as missed, cleaned of slot labels', () => {
    const result = matchRosterRows(['Top Shelf', 'Hockey Gods League • 3-1-0', 'Connor McDavid', 'Edm - C', 'RW  Nikita Kucherov', 'Ott- LW', 'Jack Hughes'], index);
    expect(result.unmatched).toEqual(['Nikita Kucherov']);
    // Everything name-shaped is still worth a search; the search only confirms real NHL names.
    expect(result.leftovers).toEqual(['Top Shelf', 'Hockey Gods League', 'Nikita Kucherov']);
  });

  it('finds several players in one pasted line', () => {
    expect(ids(['Connor McDavid  Leon Draisaitl  Zach Hyman'])).toEqual(sorted(MCDAVID, DRAISAITL, HYMAN));
  });
});

describe('nameFromRow', () => {
  it('keeps the person’s name and drops slot labels, codes and stats', () => {
    expect(nameFromRow('RW  Nikita Kucherov')).toBe('Nikita Kucherov');
    expect(nameFromRow('IR+  Alexis Lafrenière')).toBe('Alexis Lafrenière');
    expect(nameFromRow('Ott- LW')).toBe('');
    expect(nameFromRow('@SJ 7:00 pm 2 5 +3')).toBe('');
    expect(nameFromRow('Set Lineup')).toBe('');
  });
});

describe('mergeSearchMatches', () => {
  it('moves names found by search into the matches, once each', () => {
    const KUCHEROV = p('Nikita', 'Kucherov', 'TBL', 'R');
    const base = matchRosterRows(['Connor McDavid', 'RW  Nikita Kucherov', 'Bobby Unknown', 'Jack Hughes'], index);
    const merged = mergeSearchMatches(base, new Map([['Nikita Kucherov', KUCHEROV]]));
    expect(merged.matched.map((m) => [m.player.lastName, m.confidence])).toEqual([['McDavid', 'exact'], ['Hughes', 'exact'], ['Kucherov', 'likely']]);
    expect(merged.unmatched).toEqual(['Bobby Unknown']);
    expect(merged.leftovers).toEqual(['Bobby Unknown']);
    expect(mergeSearchMatches(base, new Map())).toBe(base);
  });
});

describe('rowsFromPastedText', () => {
  it('splits lines and name lists but keeps "Last, First" together', () => {
    expect(rowsFromPastedText('McDavid, Draisaitl, Hyman\nConnor Bedard; Kyle Connor\nMcDavid, Connor\nW, 5-2')).toEqual([
      'McDavid', 'Draisaitl', 'Hyman', 'Connor Bedard', 'Kyle Connor', 'McDavid, Connor', 'W, 5-2',
    ]);
  });

  it('matches a pasted list end to end', () => {
    expect(ids(rowsFromPastedText('McDavid, Draisaitl, Hyman\nMcDavid, Connor'))).toEqual(sorted(MCDAVID, DRAISAITL, HYMAN));
  });
});

describe('rowsFromOcr', () => {
  const line = (text: string, x: number, y: number, height = 0.02): OcrLine => ({ text, x, y, width: 0.2, height });

  it('groups lines on the same visual row, left to right, and keeps images in order', () => {
    const first = [line('Edm - C', 0.3, 0.205), line('Connor McDavid', 0.3, 0.18), line('C', 0.05, 0.18), line('7:00 pm', 0.8, 0.181)];
    const second = [line('Quinn Hughes', 0.3, 0.1)];
    expect(rowsFromOcr([first, second])).toEqual(['C  Connor McDavid  7:00 pm', 'Edm - C', 'Quinn Hughes']);
  });
});

describe('rosters', () => {
  it('maps the NHL roster payload and skips incomplete rows', () => {
    expect(mapRoster('EDM', {
      forwards: [{ id: 8478402, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, positionCode: 'C' }, { id: 1 }],
      goalies: [{ id: 8479406, firstName: { default: 'Stuart' }, lastName: { default: 'Skinner' }, positionCode: 'G' }],
    })).toEqual([
      { playerId: 8478402, firstName: 'Connor', lastName: 'McDavid', team: 'EDM', position: 'C' },
      { playerId: 8479406, firstName: 'Stuart', lastName: 'Skinner', team: 'EDM', position: 'G' },
    ]);
  });

  it('knows every active team code the matcher reads', () => {
    for (const team of ACTIVE_NHL_TEAMS) expect([...teamsInRow(team)]).toEqual([team]);
  });
});
