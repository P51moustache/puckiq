/**
 * Text normalisation for matching roster text (pasted, or read from a screenshot) to NHL
 * players: accents, punctuation and initials collapse the same way on both sides.
 */

/** "Lafrenière" -> "lafreniere", "J.T. Miller" -> "jt miller", "Pierre-Luc" -> "pierre luc". */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\b[a-z])\.(?=[a-z]\.)/g, '$1') // J.T. -> JT. (dots inside initials)
    .replace(/['’`.]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of a row after normalisation (letters only). */
export function nameTokens(text: string): string[] {
  const normalized = normalizeName(text);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Team abbreviations as Yahoo, ESPN, Fantrax and the NHL write them. Matched case-sensitively
 * against the original row (all caps, or Yahoo's capitalised form), so a lowercase "van" in
 * "James van Riemsdyk" is never read as Vancouver.
 */
const TEAM_ALIASES: Record<string, string[]> = {
  ANA: ['ANA', 'Ana'],
  BOS: ['BOS', 'Bos'],
  BUF: ['BUF', 'Buf'],
  CGY: ['CGY', 'Cgy', 'CAL'],
  CAR: ['CAR', 'Car'],
  CHI: ['CHI', 'Chi'],
  COL: ['COL', 'Col'],
  CBJ: ['CBJ', 'Cls', 'CLB', 'CMB'],
  DAL: ['DAL', 'Dal'],
  DET: ['DET', 'Det'],
  EDM: ['EDM', 'Edm'],
  FLA: ['FLA', 'Fla'],
  LAK: ['LAK', 'LA', 'LOS'],
  MIN: ['MIN', 'Min'],
  MTL: ['MTL', 'Mon', 'MON', 'Mtl'],
  NSH: ['NSH', 'Nsh', 'NAS'],
  NJD: ['NJD', 'NJ'],
  NYI: ['NYI'],
  NYR: ['NYR'],
  OTT: ['OTT', 'Ott'],
  PHI: ['PHI', 'Phi'],
  PIT: ['PIT', 'Pit'],
  SJS: ['SJS', 'SJ'],
  SEA: ['SEA', 'Sea'],
  STL: ['STL', 'StL', 'Stl'],
  TBL: ['TBL', 'TB'],
  TOR: ['TOR', 'Tor'],
  UTA: ['UTA', 'Uta', 'UTAH', 'Utah', 'UTH'],
  VAN: ['VAN', 'Van'],
  VGK: ['VGK', 'Veg', 'VEG', 'LV'],
  WSH: ['WSH', 'Was', 'WAS', 'Wsh'],
  WPG: ['WPG', 'Wpg', 'WIN'],
};

const ALIAS_TO_TEAM = new Map<string, string>(
  Object.entries(TEAM_ALIASES).flatMap(([team, aliases]) => aliases.map((alias) => [alias, team] as const)),
);

/**
 * The player's own NHL team codes written in a row, e.g. "Edm - C @SJ 7:00 pm" -> {EDM}.
 * Opponents ("@SJ", "vs SJ", "at SJ") are skipped.
 */
export function teamsInRow(row: string): Set<string> {
  const teams = new Set<string>();
  const words = row.match(/@?[A-Za-z]+/g) ?? [];
  words.forEach((word, index) => {
    if (word.startsWith('@')) return;
    const previous = words[index - 1]?.toLowerCase();
    if (previous === 'vs' || previous === 'v' || previous === 'at') return;
    const team = ALIAS_TO_TEAM.get(word);
    if (team) teams.add(team);
  });
  return teams;
}
