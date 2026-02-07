import type { Insight } from '../types/insights';
import type { H2HRecord, TeamPlayerStats } from '../types/gameResults';
import type { MomentumData, ClutchRating, EdgeSkaterLanding } from '../types/edgeStats';

const MAX_INSIGHTS = 10;

interface EdgeInsightData {
  skaterLanding?: EdgeSkaterLanding | null;
  momentumMap?: Map<string, MomentumData>;
  clutchMap?: Map<string, ClutchRating>;
}

/** Game shape from NHL schedule API */
interface ScheduleGame {
  homeTeam?: { abbrev?: string };
  awayTeam?: { abbrev?: string };
  [key: string]: unknown;
}

/** Standings entry from NHL standings API */
interface StandingsEntry {
  teamAbbrev: string | { default: string };
  streakCode?: string;
  gamesPlayed?: number;
  goalFor?: number;
  goalAgainst?: number;
  [key: string]: unknown;
}

/** Standings response from NHL API */
interface StandingsResponse {
  standings?: StandingsEntry[];
  [key: string]: unknown;
}

function getAbbrev(teamAbbrev: string | { default: string }): string {
  return typeof teamAbbrev === 'string' ? teamAbbrev : teamAbbrev.default;
}

function getTodayTeamAbbrevs(games: ScheduleGame[]): Set<string> {
  const abbrevs = new Set<string>();
  for (const g of games) {
    if (g.homeTeam?.abbrev) abbrevs.add(g.homeTeam.abbrev);
    if (g.awayTeam?.abbrev) abbrevs.add(g.awayTeam.abbrev);
  }
  return abbrevs;
}

function generateH2HInsights(h2hMap: Map<string, H2HRecord>): Insight[] {
  const insights: Insight[] = [];
  let idx = 0;
  for (const [, record] of h2hMap) {
    const diff = record.teamAWins - record.teamBWins;
    if (Math.abs(diff) >= 2) {
      const leader = diff > 0 ? record.teamA : record.teamB;
      const trailer = diff > 0 ? record.teamB : record.teamA;
      const wins = diff > 0 ? record.teamAWins : record.teamBWins;
      const losses = diff > 0 ? record.teamBWins : record.teamAWins;
      const text = `${leader} leads season series ${wins}-${losses} vs ${trailer}`;
      insights.push({
        id: `h2h-${idx++}`,
        text,
        teamAbbrev: leader,
        category: 'h2h',
        shareText: `${text} — PuckIQ`,
      });
    }
  }
  return insights;
}

function generateStreakInsights(standings: StandingsResponse | StandingsEntry[] | null | undefined, todayTeams?: Set<string>): Insight[] {
  const insights: Insight[] = [];
  const raw = (standings as StandingsResponse)?.standings ?? standings ?? [];
  const entries: StandingsEntry[] = Array.isArray(raw) ? raw : [];
  if (entries.length === 0) return insights;

  let idx = 0;
  for (const entry of entries) {
    const abbrev = getAbbrev(entry.teamAbbrev);
    if (todayTeams && !todayTeams.has(abbrev)) continue;

    const code: string | undefined = entry.streakCode;
    if (!code) continue;
    const match = code.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    const type = match[1];
    const count = parseInt(match[2], 10);
    if (count < 3) continue;

    const label = type === 'W' ? 'win' : type === 'L' ? 'losing' : 'OT loss';
    const text = `${abbrev} on ${count}-game ${label} streak`;
    insights.push({
      id: `streak-${idx++}`,
      text,
      teamAbbrev: abbrev,
      category: 'streak',
      shareText: `${text} — PuckIQ`,
    });
  }
  return insights;
}

function generatePlayerInsights(
  playerStatsMap: Map<string, TeamPlayerStats>,
  todayTeams: Set<string>
): Insight[] {
  const candidates: { abbrev: string; name: string; pts: number; gp: number }[] = [];

  for (const [abbrev, stats] of playerStatsMap) {
    if (!todayTeams.has(abbrev)) continue;
    if (!stats.skaters?.length) continue;
    const top = stats.skaters.reduce((best, s) => (s.points > best.points ? s : best), stats.skaters[0]);
    candidates.push({
      abbrev,
      name: `${top.firstName} ${top.lastName}`,
      pts: top.points,
      gp: top.gamesPlayed,
    });
  }

  candidates.sort((a, b) => b.pts - a.pts);
  return candidates.slice(0, 2).map((c, idx) => {
    const text = `${c.name}: ${c.pts} pts in ${c.gp} GP`;
    return {
      id: `player-${idx}`,
      text,
      teamAbbrev: c.abbrev,
      category: 'player' as const,
      shareText: `${text} — PuckIQ`,
    };
  });
}

function generateStandingsInsights(standings: StandingsResponse | StandingsEntry[] | null | undefined, todayTeams: Set<string>): Insight[] {
  const raw = (standings as StandingsResponse)?.standings ?? standings ?? [];
  const entries: StandingsEntry[] = Array.isArray(raw) ? raw : [];
  if (entries.length === 0) return [];

  const diffs = entries
    .filter((e) => {
      const abbrev = getAbbrev(e.teamAbbrev);
      return todayTeams.has(abbrev) && (e.gamesPlayed ?? 0) > 0;
    })
    .map((e) => ({
      abbrev: getAbbrev(e.teamAbbrev),
      diffPerGame: ((e.goalFor ?? 0) - (e.goalAgainst ?? 0)) / (e.gamesPlayed ?? 1),
    }))
    .sort((a, b) => Math.abs(b.diffPerGame) - Math.abs(a.diffPerGame));

  return diffs.slice(0, 3).map((d, idx) => {
    const sign = d.diffPerGame >= 0 ? 'outscoring opponents' : 'outscored by opponents';
    const val = Math.abs(d.diffPerGame).toFixed(1);
    const text = `${d.abbrev} ${sign} by ${val} goals/game`;
    return {
      id: `standings-${idx}`,
      text,
      teamAbbrev: d.abbrev,
      category: 'standings' as const,
      shareText: `${text} — PuckIQ`,
    };
  });
}

function generateEdgeInsights(edgeData: EdgeInsightData, todayTeams: Set<string>): Insight[] {
  const insights: Insight[] = [];
  let idx = 0;

  // Shot speed leader
  if (edgeData.skaterLanding?.hardestShot) {
    const entry = edgeData.skaterLanding.hardestShot;
    const speed = entry.shotSpeed?.imperial?.speed;
    const name = entry.player?.lastName?.default;
    if (speed && name) {
      const text = `Season hardest shot: ${name} at ${speed.toFixed(0)} mph`;
      insights.push({
        id: `edge-${idx++}`,
        text,
        category: 'edge',
        shareText: `${text} — PuckIQ`,
      });
    }
  }

  // Momentum insights for today's teams
  if (edgeData.momentumMap) {
    for (const [abbrev, m] of edgeData.momentumMap) {
      if (!todayTeams.has(abbrev)) continue;
      if (m.score >= 5) {
        const text = `${abbrev} riding ${m.label.toLowerCase()} momentum (${m.score > 0 ? '+' : ''}${m.score})`;
        insights.push({
          id: `edge-${idx++}`,
          text,
          teamAbbrev: abbrev,
          category: 'edge',
          shareText: `${text} — PuckIQ`,
        });
      } else if (m.score <= -5) {
        const text = `${abbrev} in a ${m.label.toLowerCase()} (${m.score})`;
        insights.push({
          id: `edge-${idx++}`,
          text,
          teamAbbrev: abbrev,
          category: 'edge',
          shareText: `${text} — PuckIQ`,
        });
      }
    }
  }

  // Clutch insights
  if (edgeData.clutchMap) {
    for (const [abbrev, c] of edgeData.clutchMap) {
      if (!todayTeams.has(abbrev)) continue;
      if (c.rating === 'CLUTCH') {
        const text = `${abbrev} is ${c.rating} in close games (${c.oneGoalRecord} in 1-goal games)`;
        insights.push({
          id: `edge-${idx++}`,
          text,
          teamAbbrev: abbrev,
          category: 'edge',
          shareText: `${text} — PuckIQ`,
        });
      } else if (c.rating === 'ICE COLD') {
        const text = `${abbrev} is ${c.rating} in close games (${c.oneGoalRecord})`;
        insights.push({
          id: `edge-${idx++}`,
          text,
          teamAbbrev: abbrev,
          category: 'edge',
          shareText: `${text} — PuckIQ`,
        });
      }
    }
  }

  return insights.slice(0, 3);
}

export function generateInsights(
  games: ScheduleGame[],
  standings: StandingsResponse | StandingsEntry[] | null | undefined,
  h2hMap: Map<string, H2HRecord>,
  playerStatsMap?: Map<string, TeamPlayerStats>,
  edgeData?: EdgeInsightData
): Insight[] {
  if (!games?.length) return [];

  const todayTeams = getTodayTeamAbbrevs(games);
  const h2h = generateH2HInsights(h2hMap);
  const streaks = generateStreakInsights(standings, todayTeams);
  const players = playerStatsMap ? generatePlayerInsights(playerStatsMap, todayTeams) : [];
  const standingsIns = generateStandingsInsights(standings, todayTeams);
  const edge = edgeData ? generateEdgeInsights(edgeData, todayTeams) : [];

  // Priority order: edge > h2h > streak > player > standings
  const all = [...edge, ...h2h, ...streaks, ...players, ...standingsIns];
  return all.slice(0, MAX_INSIGHTS);
}
