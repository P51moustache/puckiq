import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Image } from "expo-image";
import { useArena } from "./ArenaProvider";
import { ArenaButton, ArenaNote, arenaType } from "./ArenaPrimitives";
import {
  fetchArenaPreview,
  forecastChange,
  type ArenaPreviewData,
} from "../../services/arenaData";
import type { ArenaGame, SeasonEntry } from "../../types/arena";
import { gameTime } from "./GamePoster";

export function GamePreview({
  game,
  entry,
  onSave,
}: {
  game: ArenaGame;
  entry?: SeasonEntry;
  onSave: () => void;
}) {
  const { palette: p } = useArena();
  const [data, setData] = useState<ArenaPreviewData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    fetchArenaPreview(game)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [game, retry]);
  const away = data?.standings.find(
    (s) => s.team_abbrev === game.away_team_abbrev,
  );
  const home = data?.standings.find(
    (s) => s.team_abbrev === game.home_team_abbrev,
  );
  const change = forecastChange(entry?.game.forecast ?? null, game.forecast);
  const season = `${String(game.season).slice(0, 4)}–${String(game.season).slice(6)}`;
  const comparison = (
    label: string,
    a: number | null | undefined,
    h: number | null | undefined,
    suffix = "",
  ) => (
    <View
      key={label}
      style={{
        paddingVertical: 13,
        borderBottomColor: p.edge,
        borderBottomWidth: 1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: p.ink, fontFamily: arenaType.display, fontSize: 27 }}
        >
          {a == null
            ? "—"
            : `${Number.isInteger(a) ? a : a.toFixed(1)}${suffix}`}
        </Text>
        <Text
          style={{ color: p.muted, fontFamily: arenaType.body, fontSize: 12 }}
        >
          {label}
        </Text>
        <Text
          style={{ color: p.ink, fontFamily: arenaType.display, fontSize: 27 }}
        >
          {h == null
            ? "—"
            : `${Number.isInteger(h) ? h : h.toFixed(1)}${suffix}`}
        </Text>
      </View>
      {a != null && h != null && a + h > 0 && (
        <View style={{ flexDirection: "row", height: 6, marginTop: 7, gap: 3 }}>
          <View
            style={{
              flex: Math.max(a, 0.01),
              backgroundColor: p.hero,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: p.edge,
            }}
          />
          <View
            style={{
              flex: Math.max(h, 0.01),
              backgroundColor: p.ink,
              borderRadius: 4,
            }}
          />
        </View>
      )}
    </View>
  );
  const section = (title: string) => (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: arenaType.display,
        color: p.ink,
        fontSize: 32,
        marginTop: 23,
        marginBottom: 9,
      }}
    >
      {title}
    </Text>
  );
  return (
    <View>
      <View style={{ backgroundColor: p.frame, borderRadius: 15, padding: 20 }}>
        <Text
          style={{
            color: p.frameInk,
            fontFamily: arenaType.body,
            letterSpacing: 1.4,
            fontSize: 10,
          }}
        >
          GAME PREVIEW /{" "}
          {game.game_type === 1
            ? "PRESEASON"
            : game.game_type === 3
              ? "PLAYOFFS"
              : "REGULAR SEASON"}
        </Text>
        <Text
          style={{
            color: p.frameInk,
            fontFamily: arenaType.display,
            fontSize: 44,
            lineHeight: 48,
            marginTop: 8,
          }}
        >
          {game.away_team_abbrev} AT {game.home_team_abbrev}
        </Text>
        <Text
          style={{
            color: p.frameInk,
            fontFamily: arenaType.body,
            fontSize: 12,
          }}
        >
          {gameTime(game)}
          {game.venue ? ` · ${game.venue}` : ""}
        </Text>
      </View>
      <ArenaNote>
        Know the matchup before you make your call. These comparisons use{" "}
        {season} season statistics; they are not a prediction.
      </ArenaNote>
      {!data && !error && (
        <ActivityIndicator color={p.ink} style={{ margin: 25 }} />
      )}
      {error && (
        <>
          <ArenaNote>Game details could not be loaded.</ArenaNote>
          <ArenaButton
            label="Try again"
            onPress={() => setRetry((n) => n + 1)}
            secondary
          />
        </>
      )}
      {data?.notices.map((notice) => (
        <ArenaNote key={notice}>{notice}</ArenaNote>
      ))}
      {section("THE MATCHUP")}
      <View
        style={{
          backgroundColor: p.paper,
          borderWidth: 1.5,
          borderColor: p.edge,
          padding: 17,
          borderRadius: 14,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            style={{
              color: p.ink,
              fontFamily: arenaType.body,
              fontWeight: "800",
            }}
          >
            {game.away_team_abbrev} / AWAY
          </Text>
          <Text
            style={{
              color: p.ink,
              fontFamily: arenaType.body,
              fontWeight: "800",
            }}
          >
            {game.home_team_abbrev} / HOME
          </Text>
        </View>
        {comparison("Points", away?.points, home?.points)}
        {comparison(
          "Goals per game",
          away?.games_played ? away.goals_for / away.games_played : null,
          home?.games_played ? home.goals_for / home.games_played : null,
        )}
        {comparison(
          "Goals allowed / game",
          away?.games_played ? away.goals_against / away.games_played : null,
          home?.games_played ? home.goals_against / home.games_played : null,
        )}
        {comparison("Last 10 wins", away?.l10_wins, home?.l10_wins)}
        <Text
          style={{
            color: p.muted,
            fontFamily: arenaType.body,
            fontSize: 11,
            marginTop: 13,
          }}
        >
          {away || home
            ? `Standings snapshot: ${(away ?? home)!.snapshot_date}`
            : "No standings snapshot is available for this season."}
        </Text>
      </View>
      {section("BETWEEN THE PIPES")}
      <Text
        style={{
          color: p.muted,
          fontFamily: arenaType.body,
          fontSize: 13,
          lineHeight: 20,
          marginBottom: 13,
        }}
      >
        Team goalie season numbers. Starting goalies are unconfirmed in this
        feed.
      </Text>
      {[game.away_team_abbrev, game.home_team_abbrev].map((team) => (
        <View
          key={team}
          style={{
            backgroundColor: p.paper,
            borderColor: p.edge,
            borderWidth: 1,
            borderRadius: 13,
            padding: 15,
            marginBottom: 9,
          }}
        >
          <Text
            style={{
              fontFamily: arenaType.body,
              color: p.ink,
              fontWeight: "800",
              marginBottom: 10,
            }}
          >
            {team}
          </Text>
          {data?.goalies
            .filter((g) => g.team_abbrev === team)
            .slice(0, 2)
            .map((goalie) => (
              <View
                key={goalie.player_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 8,
                }}
              >
                {goalie.headshot && (
                  <Image
                    source={{ uri: goalie.headshot }}
                    style={{
                      width: 49,
                      height: 49,
                      backgroundColor: p.soft,
                      borderRadius: 25,
                    }}
                    contentFit="contain"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.ink,
                      fontWeight: "700",
                    }}
                  >
                    {goalie.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.muted,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {goalie.games_played} GP ·{" "}
                    {goalie.save_pctg == null
                      ? "—"
                      : goalie.save_pctg.toFixed(3)}{" "}
                    SV% ·{" "}
                    {goalie.goals_against_avg == null
                      ? "—"
                      : goalie.goals_against_avg.toFixed(2)}{" "}
                    GAA
                  </Text>
                </View>
              </View>
            ))}
          {!data?.goalies.some((g) => g.team_abbrev === team) && (
            <Text
              style={{
                fontFamily: arenaType.body,
                color: p.muted,
                fontSize: 13,
              }}
            >
              No goalie statistics available for this season.
            </Text>
          )}
        </View>
      ))}
      {section("SPECIAL TEAMS")}
      <View
        style={{
          backgroundColor: p.paper,
          borderWidth: 1,
          borderColor: p.edge,
          padding: 17,
          borderRadius: 14,
        }}
      >
        <Text
          style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 12 }}
        >
          {game.away_team_abbrev} on the left · {game.home_team_abbrev} on the
          right
        </Text>
        {comparison(
          "Power play",
          data?.specialTeams.find((t) => t.team === game.away_team_abbrev)
            ?.powerPlay,
          data?.specialTeams.find((t) => t.team === game.home_team_abbrev)
            ?.powerPlay,
          "%",
        )}
        {comparison(
          "Penalty kill",
          data?.specialTeams.find((t) => t.team === game.away_team_abbrev)
            ?.penaltyKill,
          data?.specialTeams.find((t) => t.team === game.home_team_abbrev)
            ?.penaltyKill,
          "%",
        )}
      </View>
      {section("WHAT CHANGED?")}
      <ArenaNote>
        {!entry
          ? "Save this card to capture the current forecast. Come back before puck drop to see whether the same model has moved."
          : change !== null
            ? `${game.home_team_abbrev} win probability: ${Math.round(entry.game.forecast!.homeProbability * 100)}% when saved → ${Math.round(game.forecast!.homeProbability * 100)}% now (${change > 0 ? "+" : ""}${change.toFixed(1)} percentage points).`
            : "This saved card does not have a comparable forecast from the same model version. No change is calculated."}
        {entry ? ` Saved ${new Date(entry.savedAt).toLocaleString()}.` : ""}
      </ArenaNote>
      {game.forecast && (
        <Text
          style={{
            fontFamily: arenaType.body,
            color: p.muted,
            fontSize: 11,
            lineHeight: 17,
            marginBottom: 15,
          }}
        >
          {game.forecast.model} · {game.forecast.version} · published{" "}
          {new Date(game.forecast.predictedAt).toLocaleString()}
        </Text>
      )}
      <ArenaButton
        label={entry ? "In your season book" : "Save to season book"}
        icon="bookmark-outline"
        onPress={onSave}
        disabled={!!entry}
      />
    </View>
  );
}
