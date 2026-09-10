import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useArena } from "./ArenaProvider";
import { ArenaNote, arenaType } from "./ArenaPrimitives";
import type { ArenaGame, SeasonEntry } from "../../types/arena";
import { isFinalGame } from "../../services/arenaData";
import { gameTime } from "./GamePoster";

export function SeasonBook({
  entries,
  results,
  onOpen,
  onRemove,
}: {
  entries: SeasonEntry[];
  results: ArenaGame[];
  onOpen: (game: ArenaGame) => void;
  onRemove: (id: number) => void;
}) {
  const { palette: p } = useArena();
  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: arenaType.display,
          color: p.ink,
          fontSize: 49,
        }}
      >
        KEEP THE SEASON.
      </Text>
      <Text
        style={{
          fontFamily: arenaType.body,
          color: p.muted,
          fontSize: 14,
          lineHeight: 22,
          marginBottom: 23,
        }}
      >
        Your games. The forecast you saved. The way it played out. Kept on this
        device.
      </Text>
      {!entries.length && (
        <>
          <View
            style={{
              height: 165,
              margin: 14,
              backgroundColor: p.soft,
              borderWidth: 2,
              borderColor: p.frame,
              borderStyle: "dashed",
              borderRadius: 14,
              transform: [{ rotate: "-3deg" }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="ticket-outline" color={p.ink} size={46} />
            <Text
              style={{
                fontFamily: arenaType.display,
                fontSize: 28,
                color: p.ink,
                marginTop: 10,
              }}
            >
              YOUR FIRST GAME GOES HERE
            </Text>
          </View>
          <ArenaNote>
            Tap Save on a game card. If a forecast is available, it is captured
            with its model and publication time.
          </ArenaNote>
        </>
      )}
      {entries.map((entry, index) => {
        const current =
          results.find((g) => g.id === entry.game.id) ?? entry.game;
        const forecast = entry.game.forecast;
        return (
          <View
            key={entry.game.id}
            style={{
              marginVertical: 10,
              marginHorizontal: 4,
              borderWidth: 2,
              borderColor: p.frame,
              borderRadius: 14,
              backgroundColor: p.paper,
              transform: [{ rotate: index % 2 ? "1deg" : "-1deg" }],
              overflow: "hidden",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open saved ${entry.game.away_team_abbrev} at ${entry.game.home_team_abbrev}`}
              onPress={() => onOpen(current)}
              style={{ padding: 18 }}
            >
              <Text
                style={{
                  fontFamily: arenaType.body,
                  color: p.muted,
                  fontSize: 10,
                  letterSpacing: 1.2,
                }}
              >
                SEASON BOOK / {String(index + 1).padStart(3, "0")}
              </Text>
              <Text
                style={{
                  fontFamily: arenaType.display,
                  fontSize: 36,
                  color: p.ink,
                  marginTop: 7,
                }}
              >
                {entry.game.away_team_abbrev} AT {entry.game.home_team_abbrev}
              </Text>
              <Text
                style={{
                  fontFamily: arenaType.body,
                  color: p.muted,
                  fontSize: 12,
                }}
              >
                {gameTime(entry.game)}
              </Text>
              <View
                style={{
                  borderTopWidth: 1,
                  borderStyle: "dashed",
                  borderColor: p.edge,
                  marginTop: 16,
                  paddingTop: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 15,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.muted,
                      fontSize: 10,
                    }}
                  >
                    SAVED FORECAST
                  </Text>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.ink,
                      fontWeight: "700",
                      marginTop: 5,
                    }}
                  >
                    {forecast
                      ? `${entry.game.home_team_abbrev} ${Math.round(forecast.homeProbability * 100)}%`
                      : "Not available at save"}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.muted,
                      fontSize: 10,
                    }}
                  >
                    RESULT
                  </Text>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      color: p.ink,
                      fontWeight: "700",
                      marginTop: 5,
                    }}
                  >
                    {isFinalGame(current)
                      ? `${current.away_score} – ${current.home_score} FINAL`
                      : "Awaiting final"}
                  </Text>
                </View>
              </View>
            </Pressable>
            <View
              style={{
                backgroundColor: p.soft,
                paddingLeft: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: arenaType.body,
                  color: p.muted,
                  fontSize: 10,
                }}
              >
                {isFinalGame(entry.game) ? "Saved after final" : "Saved"}{" "}
                {new Date(entry.savedAt).toLocaleDateString()}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.game.away_team_abbrev} at ${entry.game.home_team_abbrev} from season book`}
                onPress={() => onRemove(entry.game.id)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" color={p.muted} size={17} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
