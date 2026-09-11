import { standingsSnapshotDate } from './nhl-api.mjs';

export function validateStandingsSnapshot(rows, season, expectedTeams) {
  const sourceDate = standingsSnapshotDate(rows, season);
  const expected = new Set(expectedTeams);
  if (expected.size === 0 || expected.size !== expectedTeams.length) throw new Error('Invalid expected standings coverage');
  const seen = new Set();
  for (const row of rows) {
    const abbrev = row.teamAbbrev?.default ?? row.teamAbbrev;
    if (seen.has(abbrev)) throw new Error(`Duplicate standings team ${abbrev}`);
    if (!expected.has(abbrev)) throw new Error(`Unexpected standings team ${abbrev}`);
    seen.add(abbrev);
    for (const field of ['gamesPlayed','wins','losses','otLosses','points','goalFor','goalAgainst']) {
      if (!Number.isInteger(row[field]) || row[field] < 0) throw new Error(`${abbrev} has missing or invalid ${field}`);
    }
    if (row.gamesPlayed !== row.wins + row.losses + row.otLosses) throw new Error(`${abbrev} standings record does not match games played`);
    if (row.points !== 2 * row.wins + row.otLosses) throw new Error(`${abbrev} standings points do not match its record`);
  }
  if (seen.size !== expected.size) throw new Error('Incomplete standings club coverage');
  return sourceDate;
}

export function standingsRequestDate(catalog, season, today) {
  const matches = catalog?.seasons?.filter(row => row.id === season) ?? [];
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10) === value;
  if (matches.length !== 1 || !validDate(matches[0].standingsStart) || !validDate(matches[0].standingsEnd) || !validDate(today)) throw new Error('Invalid or missing standings season catalog entry');
  const {standingsStart,standingsEnd} = matches[0];
  if (standingsEnd < standingsStart) throw new Error('Invalid standings season catalog range');
  if (today < standingsStart) throw new Error('Requested standings season has not started');
  return today < standingsEnd ? today : standingsEnd;
}
