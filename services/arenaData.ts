import { supabase } from "../lib/supabase";
import type {
  ArenaForecast,
  ArenaGame,
  ArenaGoalie,
  ArenaStanding,
  SourceFreshness,
} from "../types/arena";
import { getArenaTeam } from "../constants/arenaTheme";
import { getPlayerDetail, type GoalieSeasonStats } from './playerDetail';

const GAME_COLUMNS =
  "id,season,game_date,start_time_utc,game_type,game_state,home_team_abbrev,away_team_abbrev,home_score,away_score,venue,updated_at";
export const isFinalGame = (game: ArenaGame) =>
  ["OFF", "FINAL"].includes(game.game_state);
export const isLiveGame = (game: ArenaGame) =>
  ["LIVE", "CRIT"].includes(game.game_state);

export const nhlDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function arenaGameHeadline(
  game: ArenaGame | null,
  now = new Date(),
): string {
  if (!game) return "SEASON\nAHEAD";
  if (isFinalGame(game)) return "FINAL\nBUZZER";
  return isLiveGame(game) || game.game_date === nhlDate(now)
    ? "GAME\nNIGHT"
    : "NEXT\nGAME";
}

export function normalizeArenaForecast(
  row: Record<string, unknown> | null,
): ArenaForecast | null {
  if (!row || row.model_type !== "game_winner" || row.data_quality === "stale")
    return null;
  const home = row.home_win_prob,
    away = row.away_win_prob;
  if (
    typeof home !== "number" ||
    typeof away !== "number" ||
    !Number.isFinite(home) ||
    !Number.isFinite(away) ||
    home < 0 ||
    home > 1 ||
    away < 0 ||
    away > 1 ||
    Math.abs(home + away - 1) > 0.001
  )
    return null;
  if (
    typeof row.model_version !== "string" ||
    !row.model_version ||
    typeof row.predicted_at !== "string" ||
    !Number.isFinite(Date.parse(row.predicted_at))
  )
    return null;
  return {
    homeProbability: home,
    model: "PuckIQ AI",
    version: row.model_version,
    predictedAt: row.predicted_at,
  };
}

export function orderArenaGames(
  games: ArenaGame[],
  homeTeam?: string | null,
): ArenaGame[] {
  const favorite = (g: ArenaGame) =>
    homeTeam && [g.home_team_abbrev, g.away_team_abbrev].includes(homeTeam)
      ? 0
      : 1;
  return [...games].sort(
    (a, b) =>
      favorite(a) - favorite(b) ||
      (isFinalGame(a) && isFinalGame(b)
        ? Date.parse(b.start_time_utc) - Date.parse(a.start_time_utc)
        : Date.parse(a.start_time_utc) - Date.parse(b.start_time_utc)),
  );
}

export function forecastChange(
  saved: ArenaForecast | null,
  current: ArenaForecast | null,
): number | null {
  return saved &&
    current &&
    saved.model === current.model &&
    saved.version === current.version
    ? (current.homeProbability - saved.homeProbability) * 100
    : null;
}

export async function fetchArenaGames(
  homeTeam?: string | null,
): Promise<{ games: ArenaGame[]; notice: string | null }> {
  // NHL game dates use Eastern time. Keep late Pacific games on the correct slate.
  const today = nhlDate();
  let { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .gte("game_date", today)
    .order("start_time_utc")
    .limit(64);
  if (error)
    throw new Error(
      "The schedule could not be loaded. Pull down to try again.",
    );
  const team = homeTeam ? getArenaTeam(homeTeam) : null;
  if (team) {
    // A long league slate must not hide the selected team's next matchup.
    const nextHome = await supabase
      .from("games")
      .select(GAME_COLUMNS)
      .gte("game_date", today)
      .or(
        `home_team_abbrev.eq.${team.abbrev},away_team_abbrev.eq.${team.abbrev}`,
      )
      .order("start_time_utc")
      .limit(1);
    if (nextHome.error)
      throw new Error(
        "Your team’s next game could not be loaded. Pull down to try again.",
      );
    for (const game of nextHome.data ?? [])
      if (!data?.some((row) => row.id === game.id))
        data = [...(data ?? []), game];
  }
  if (!data?.length) {
    const recent = await supabase
      .from("games")
      .select(GAME_COLUMNS)
      .in("game_state", ["OFF", "FINAL"])
      .order("start_time_utc", { ascending: false })
      .limit(16);
    if (recent.error)
      throw new Error(
        "Recent games could not be loaded. Pull down to try again.",
      );
    data = recent.data;
  }
  const rows = data ?? [];
  if (!rows.length) return { games: [], notice: null };
  const predictions = await supabase
    .from("ml_predictions")
    .select(
      "game_id,home_win_prob,away_win_prob,model_type,model_version,predicted_at,data_quality",
    )
    .in(
      "game_id",
      rows.map((g) => g.id),
    )
    .eq("model_type", "game_winner")
    .order("predicted_at", { ascending: false });
  const forecasts = new Map<number, ArenaForecast | null>();
  for (const row of predictions.data ?? [])
    if (!forecasts.has(row.game_id))
      forecasts.set(row.game_id, normalizeArenaForecast(row));
  return {
    games: rows.map(
      (row) =>
        applyGameFreshness({ ...row, forecast: forecasts.get(row.id) ?? null } as ArenaGame),
    ),
    notice: predictions.error
      ? "Forecasts are temporarily unavailable. The schedule is still available."
      : null,
  };
}

export async function fetchArenaStandings(
  season?: number,
): Promise<ArenaStanding[]> {
  let snapshotQuery = supabase
    .from("standings")
    .select("season,snapshot_date")
    .order("season", { ascending: false })
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (season) snapshotQuery = snapshotQuery.eq("season", season);
  const snapshot = await snapshotQuery;
  if (snapshot.error) throw new Error("Standings could not be loaded.");
  const latest = snapshot.data?.[0];
  if (!latest) return [];
  const { data, error } = await supabase
    .from("standings")
    .select(
      "team_abbrev,season,snapshot_date,games_played,wins,losses,ot_losses,points,goals_for,goals_against,l10_wins,l10_losses,l10_ot_losses,conference,division,league_sequence",
    )
    .eq("season", latest.season)
    .eq("snapshot_date", latest.snapshot_date)
    .order("league_sequence");
  if (error) throw new Error("Standings could not be loaded.");
  return (data ?? []) as ArenaStanding[];
}

export interface ArenaPreviewData {
  sources?: { goalies: SourceFreshness; specialTeams: SourceFreshness };
  standings: ArenaStanding[];
  goalies: ArenaGoalie[];
  specialTeams: {
    team: string;
    powerPlay: number | null;
    penaltyKill: number | null;
  }[];
  notices: string[];
}

export async function fetchArenaPreview(
  game: ArenaGame,
): Promise<ArenaPreviewData> {
  const teams = [game.away_team_abbrev, game.home_team_abbrev];
  const [standingsResult, goalieResult, specialResult] =
    await Promise.allSettled([
      fetchArenaStandings(game.season),
      supabase
        .from("goalie_season_stats")
        .select(
          "player_id,team_abbrev,games_played,save_pctg,goals_against_avg,updated_at",
        )
        .eq("season", game.season)
        .in("team_abbrev", teams)
        .order("games_played", { ascending: false }),
      supabase
        .from("team_stat_categories")
        .select("team_abbrev,data,fetched_at")
        .eq("season", game.season)
        .eq("stat_category", "summary")
        .in("team_abbrev", teams).order("fetched_at", { ascending: false }),
    ]);
  const notices: string[] = [];
  const standings =
    standingsResult.status === "fulfilled"
      ? standingsResult.value.filter((s) => teams.includes(s.team_abbrev))
      : [];
  if (standingsResult.status === "rejected")
    notices.push("Team records could not be refreshed.");
  const goalieRows =
    goalieResult.status === "fulfilled" && !goalieResult.value.error
      ? (goalieResult.value.data ?? [])
      : [];
  if (goalieResult.status === "rejected" || goalieResult.value.error)
    notices.push("Goalie statistics could not be refreshed.");
  let goalies: ArenaGoalie[] = [];
  if (goalieRows.length) {
    const checked = await Promise.all(goalieRows.map(async (g): Promise<ArenaGoalie | null> => {
      const detail = await getPlayerDetail(g.player_id);
      if (!detail || detail.season !== game.season || !detail.seasonStats) return null;
      // Full-player totals belong to the current roster club, never both sides
      // of a matchup when historical team splits exist for a traded goalie.
      if (detail.bio.position !== 'G' || detail.bio.teamAbbrev !== g.team_abbrev) return null;
      const stats = detail.seasonStats as GoalieSeasonStats;
      if (stats.gamesPlayed === null) return null;
      return {
        ...g,
        games_played: stats.gamesPlayed,
        save_pctg: stats.savePctg,
        goals_against_avg: stats.goalsAgainstAvg,
        updated_at: detail.asOf,
        name: detail.bio.fullName,
        headshot: detail.bio.headshotUrl ?? null,
      };
    }));
    goalies = checked.filter((g): g is ArenaGoalie => g !== null);
    if (goalies.length < goalieRows.length) notices.push('Some goalie season totals are unavailable or conflict with game records.');
  }
  const rate = (value: unknown) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
      ? value * 100
      : null;
  const specialRows =
    specialResult.status === "fulfilled" && !specialResult.value.error
      ? (specialResult.value.data ?? []).filter(row => standings.some(s => s.team_abbrev === row.team_abbrev && s.games_played === row.data?.gamesPlayed))
      : [];
  if (specialResult.status === "rejected" || specialResult.value.error)
    notices.push("Special-teams statistics could not be refreshed.");
  const oldest = (rows: Record<string, unknown>[], field: string): string | null => {
    if (!rows.length || rows.some(row => typeof row[field] !== 'string' || !Number.isFinite(Date.parse(row[field] as string)))) return null;
    return new Date(Math.min(...rows.map(row => Date.parse(row[field] as string)))).toISOString();
  };
  return {
    sources: { goalies: sourceFreshness(oldest(goalies.map(g => ({updated_at:g.updated_at})), 'updated_at')), specialTeams: sourceFreshness(oldest(specialRows, 'fetched_at')) },
    standings,
    goalies,
    specialTeams: specialRows.map((row) => ({
      team: row.team_abbrev,
      powerPlay: rate(row.data?.powerPlayPct),
      penaltyKill: rate(row.data?.penaltyKillPct),
    })),
    notices,
  };
}

export async function fetchArenaResults(ids: number[]): Promise<ArenaGame[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .in("id", ids);
  if (error)
    throw new Error(
      "Saved-game results could not be refreshed. Your saved cards are safe.",
    );
  return (data ?? []).map((row) => ({ ...row, forecast: null }) as ArenaGame);
}

/** Source age is measured from the stored timestamp, never the fetch completion. */
export function sourceFreshness(asOf: string | null | undefined, now = new Date(), maxAgeHours = 36): SourceFreshness {
  const timestamp = asOf ? Date.parse(asOf) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > now.getTime() + 300_000) return { asOf: asOf ?? null, ageHours: null, status: 'unknown' };
  const ageHours = Math.max(0, (now.getTime() - timestamp) / 3_600_000);
  return { asOf: asOf!, ageHours, status: ageHours > maxAgeHours ? 'stale' : 'fresh' };
}
export function applyGameFreshness(game: ArenaGame, now = new Date()): ArenaGame {
  const source = sourceFreshness(game.updated_at, now);
  const prediction = sourceFreshness(game.forecast?.predictedAt, now);
  const historical = isFinalGame(game) || isLiveGame(game);
  const pregame = game.forecast && Date.parse(game.forecast.predictedAt) <= Date.parse(game.start_time_utc);
  const available = game.game_type !== 1 && !!pregame && (historical || (prediction.status === 'fresh' && source.status === 'fresh'));
  return { ...game, forecast: available ? game.forecast : null, freshness: { source, prediction, forecastUnavailable: !available } };
}
export async function fetchArenaGameById(id: number): Promise<ArenaGame | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const result = await supabase.from('games').select(GAME_COLUMNS).eq('id', id).limit(1);
  if (result.error) throw new Error('This game could not be loaded. Please try again.');
  const game = result.data?.[0];
  if (!game) return null;
  const predictions = await supabase.from('ml_predictions')
    .select('game_id,home_win_prob,away_win_prob,model_type,model_version,predicted_at,data_quality')
    .eq('game_id', id).eq('model_type', 'game_winner').order('predicted_at', { ascending: false }).limit(1);
  return applyGameFreshness({ ...game, forecast: predictions.error ? null : normalizeArenaForecast(predictions.data?.[0] ?? null) } as ArenaGame);
}
