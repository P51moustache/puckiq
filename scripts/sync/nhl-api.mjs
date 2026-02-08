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
export function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 10) return parseInt(`${year}${year + 1}`);
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
  if (raw && /^\d{8}$/.test(raw)) {
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
  scores: (date) => `${NHL_API_BASE}/score/${date}`,
  standings: () => `${NHL_API_BASE}/standings/now`,
  teamScheduleSeason: (team, season) => `${NHL_API_BASE}/club-schedule-season/${team}/${season}`,
  teamStats: (team) => `${NHL_API_BASE}/club-stats/${team}/now`,
  roster: (team) => `${NHL_API_BASE}/roster/${team}/current`,
  playerLanding: (playerId) => `${NHL_API_BASE}/player/${playerId}/landing`,
  teamSummary: (seasonId) =>
    `${NHL_STATS_BASE}/team/summary?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`,
  skaterStatsLeaders: () => `${NHL_API_BASE}/skater-stats-leaders/current`,
};
