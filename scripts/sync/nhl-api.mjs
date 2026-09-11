/**
 * NHL API helper functions for sync scripts.
 * Shared by all sync modules to avoid duplication.
 */

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest/en';

// All 32 NHL team abbreviations
export const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
  'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
  'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
  'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
];

/**
 * Returns the current NHL season as an integer (e.g., 20252026).
 * Matches backend-engineer's schema which uses INTEGER for season.
 */
export function getCurrentSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month >= 7) return parseInt(`${year}${year + 1}`);
  return parseInt(`${year - 1}${year}`);
}

/**
 * Returns the current NHL season as a string (e.g., '20252026').
 * Used by game_results table which stores season as TEXT.
 */
export function getCurrentSeasonStr() {
  const s = getCurrentSeason();
  return String(s);
}

/**
 * Parse --season flag from process.argv, or fall back to current season.
 * Accepts both `--season 20242025` and `--season=20242025` formats.
 * Returns { season: number, seasonStr: string }.
 */
export function parseSeasonArg(argv = process.argv) {
  const idx = argv.indexOf('--season');
  let raw = null;
  if (idx !== -1 && idx + 1 < argv.length) {
    raw = argv[idx + 1];
  } else {
    const eqArg = argv.find(a => a.startsWith('--season='));
    if (eqArg) raw = eqArg.split('=')[1];
  }
  if (idx !== -1 || argv.some(a => a.startsWith('--season='))) {
    if (!raw || !/^\d{8}$/.test(raw) || Number(raw.slice(4)) !== Number(raw.slice(0, 4)) + 1) {
      throw new Error('Season must contain consecutive years, e.g. --season=20262027');
    }
    const season = parseInt(raw);
    return { season, seasonStr: raw };
  }
  return { season: getCurrentSeason(), seasonStr: getCurrentSeasonStr() };
}

/**
 * Format a Date as YYYY-MM-DD.
 */
export function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/** Never stamp an old/current endpoint response with the requested year or fetch time. */
export function standingsSnapshotDate(rows, season) {
  if (!rows.length || rows.some(row => Number(row.seasonId) !== season)) {
    throw new Error(`Standings response does not match requested season ${season}`);
  }
  const dates = new Set(rows.map(row => row.date));
  const date = rows[0].date;
  if (dates.size !== 1 || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) {
    throw new Error('Standings response has no single valid source snapshot date');
  }
  return date;
}

/**
 * Fetch with retry and rate limiting.
 * @param {string} url
 * @param {number} retries - Number of retries (default 2)
 * @param {number} delayMs - Delay between retries (default 1000ms)
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchWithRetry(url, retries = 2, delayMs = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  Retry ${attempt + 1}/${retries} for ${url}: ${err.message}`);
      await sleep(delayMs * (attempt + 1));
    }
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// NHL API endpoints
export const endpoints = {
  standingsSeasons: () => `${NHL_API_BASE}/standings-season`,
  scores: (date) => `${NHL_API_BASE}/score/${date}`,
  standings: (date = 'now') => `${NHL_API_BASE}/standings/${date}`,
  teamScheduleSeason: (team, season) => `${NHL_API_BASE}/club-schedule-season/${team}/${season}`,
  teamStats: (team, season) => `${NHL_API_BASE}/club-stats/${team}/${season}/2`,
  roster: (team) => `${NHL_API_BASE}/roster/${team}/current`,
  playerLanding: (playerId) => `${NHL_API_BASE}/player/${playerId}/landing`,
  teamSummary: (seasonId) =>
    `${NHL_STATS_BASE}/team/summary?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`,
  teamStatCategory: (category, seasonId) =>
    `${NHL_STATS_BASE}/team/${category}?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`,
  skaterStatsLeaders: () => `${NHL_API_BASE}/skater-stats-leaders/current`,
};
