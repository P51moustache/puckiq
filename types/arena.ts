export interface ArenaForecast {
  homeProbability: number;
  model: string;
  version: string;
  predictedAt: string;
}

export interface ArenaGame {
  freshness?: { source: SourceFreshness; prediction: SourceFreshness; forecastUnavailable: boolean };
  id: number;
  season: number;
  game_date: string;
  start_time_utc: string;
  game_type: number;
  game_state: string;
  home_team_abbrev: string;
  away_team_abbrev: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  updated_at: string | null;
  forecast: ArenaForecast | null;
}

export interface ArenaStanding {
  team_abbrev: string;
  season: number;
  snapshot_date: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  l10_wins: number;
  l10_losses: number;
  l10_ot_losses: number;
  conference: string | null;
  division: string | null;
  league_sequence: number | null;
}

export interface ArenaGoalie {
  updated_at?: string;
  player_id: number;
  team_abbrev: string;
  name: string;
  headshot: string | null;
  games_played: number;
  save_pctg: number | null;
  goals_against_avg: number | null;
}

export interface SeasonEntry {
  game: ArenaGame;
  savedAt: string;
}

export interface SourceFreshness { asOf: string | null; ageHours: number | null; status: "fresh" | "stale" | "unknown"; }
