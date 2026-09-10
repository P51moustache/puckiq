import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useArena } from "./ArenaProvider";
import { ArenaHeader, ArenaNote, arenaType } from "./ArenaPrimitives";
import { GamePoster, gameTime } from "./GamePoster";
import { GamePreview } from "./GamePreview";
import { SeasonBook } from "./SeasonBook";
import { useArenaGames } from "../../hooks/useArenaGames";
import {
  fetchArenaResults,
  isFinalGame,
  isLiveGame,
  orderArenaGames,
} from "../../services/arenaData";
import {
  getSeasonBook,
  removeFromSeasonBook,
  saveToSeasonBook,
  subscribeSeasonBook,
} from "../../services/seasonBook";
import type { ArenaGame, SeasonEntry } from "../../types/arena";

export default function TonightScreen() {
  const { palette: p, homeTeam } = useArena();
  const { games, loading, error, notice, refresh } = useArenaGames(
    homeTeam?.abbrev,
  );
  const [section, setSection] = useState<"tonight" | "preview" | "book">(
    "tonight",
  );
  const [selection, setSelection] = useState<ArenaGame | null>(null);
  const [entries, setEntries] = useState<SeasonEntry[]>([]);
  const [results, setResults] = useState<ArenaGame[]>([]);
  const [bookError, setBookError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const ordered = useMemo(
    () => orderArenaGames(games, homeTeam?.abbrev),
    [games, homeTeam?.abbrev],
  );
  const featured = ordered[0] ?? null;
  const selected =
    games.find((g) => g.id === selection?.id) ?? selection ?? featured;
  const reloadBook = useCallback(async () => {
    try {
      const next = await getSeasonBook();
      setEntries(next);
      setBookError(null);
    } catch {
      setBookError(
        "The season book could not be read. Your stored cards have been preserved.",
      );
    }
  }, []);
  useEffect(() => {
    void reloadBook();
    return subscribeSeasonBook(() => void reloadBook());
  }, [reloadBook]);
  useEffect(() => {
    let alive = true;
    fetchArenaResults(entries.map((entry) => entry.game.id))
      .then((next) => {
        if (alive) setResults(next);
      })
      .catch((err) => {
        if (alive) setBookError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [entries]);
  const save = async (game: ArenaGame) => {
    try {
      await saveToSeasonBook(game);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
    } catch {
      Alert.alert(
        "Card could not be saved",
        "Please try again. Your existing season book has been preserved.",
      );
    }
  };
  const remove = async (id: number) => {
    try {
      await removeFromSeasonBook(id);
    } catch {
      Alert.alert("Card could not be removed", "Please try again.");
    }
  };
  const openGame = (game: ArenaGame) => {
    setSelection(game);
    setSection("preview");
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const upcoming = games.some((g) => !isFinalGame(g));
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.page }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 38 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && games.length > 0}
            onRefresh={() => {
              void refresh();
              void reloadBook();
            }}
            tintColor={p.ink}
          />
        }
      >
        <ArenaHeader />
        <View
          style={{
            flexDirection: "row",
            padding: 4,
            backgroundColor: p.soft,
            borderWidth: 1.5,
            borderColor: p.edge,
            borderRadius: 13,
            marginBottom: 18,
          }}
        >
          {(["tonight", "preview", "book"] as const).map((key, i) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === key }}
              onPress={() => setSection(key)}
              style={{
                flex: 1,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 9,
                backgroundColor: section === key ? p.frame : "transparent",
              }}
            >
              <Text
                style={{
                  color: section === key ? p.frameInk : p.ink,
                  fontFamily: arenaType.body,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {["Tonight", "Game preview", "Season book"][i]}
              </Text>
            </Pressable>
          ))}
        </View>
        {error && (
          <ArenaNote>
            {error}
            {games.length ? " Showing the last loaded schedule." : ""}
          </ArenaNote>
        )}
        {notice && <ArenaNote>{notice}</ArenaNote>}
        {bookError && <ArenaNote>{bookError}</ArenaNote>}
        {section === "tonight" && (
          <>
            {loading && !games.length ? (
              <ActivityIndicator color={p.ink} style={{ marginVertical: 15 }} />
            ) : null}
            {!upcoming && !loading && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 13,
                }}
              >
                <Ionicons name="calendar-outline" color={p.muted} size={15} />
                <Text
                  style={{
                    color: p.muted,
                    fontFamily: arenaType.body,
                    fontSize: 11,
                    flex: 1,
                  }}
                >
                  No upcoming games in the feed.{" "}
                  {games.length
                    ? "Revisit the last slate below."
                    : "Your next matchup will appear here."}
                </Text>
              </View>
            )}
            <GamePoster
              game={featured}
              saved={entries.some((e) => e.game.id === featured?.id)}
              onSave={() => {
                if (featured) void save(featured);
              }}
              onPreview={() => {
                if (featured) openGame(featured);
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 13,
                marginBottom: 10,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: arenaType.display,
                  fontSize: 32,
                  color: p.ink,
                }}
              >
                {upcoming ? "AROUND THE LEAGUE" : "THE LAST SLATE"}
              </Text>
              <Text
                style={{
                  fontFamily: arenaType.body,
                  fontSize: 10,
                  color: p.muted,
                }}
              >
                {games.length} GAMES
              </Text>
            </View>
            {games.map((game) => (
              <Pressable
                key={game.id}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${game.away_team_abbrev} at ${game.home_team_abbrev}`}
                onPress={() => openGame(game)}
                style={{
                  backgroundColor: p.paper,
                  borderColor: p.edge,
                  borderWidth: 1.5,
                  borderRadius: 13,
                  marginBottom: 9,
                  padding: 15,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 5,
                    alignSelf: "stretch",
                    backgroundColor: [
                      game.home_team_abbrev,
                      game.away_team_abbrev,
                    ].includes(homeTeam?.abbrev ?? "")
                      ? p.action
                      : p.soft,
                    borderRadius: 5,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: arenaType.display,
                      fontSize: 25,
                      color: p.ink,
                    }}
                  >
                    {game.away_team_abbrev} / {game.home_team_abbrev}
                  </Text>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      fontSize: 10,
                      color: p.muted,
                      marginTop: 3,
                    }}
                  >
                    {gameTime(game)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      fontWeight: "800",
                      fontSize: 14,
                      color: p.ink,
                    }}
                  >
                    {isFinalGame(game) || isLiveGame(game)
                      ? `${game.away_score} – ${game.home_score}`
                      : "PREVIEW"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: arenaType.body,
                      fontSize: 9,
                      color: p.muted,
                      marginTop: 4,
                    }}
                  >
                    {isFinalGame(game)
                      ? "FINAL"
                      : isLiveGame(game)
                        ? "IN PROGRESS"
                        : game.game_type === 1
                          ? "PRESEASON"
                          : "UPCOMING"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={p.muted} />
              </Pressable>
            ))}
            {featured?.updated_at && (
              <Text
                style={{
                  fontFamily: arenaType.body,
                  color: p.muted,
                  fontSize: 10,
                  lineHeight: 17,
                  marginTop: 6,
                }}
              >
                Featured game last synced{" "}
                {new Date(featured.updated_at).toLocaleString()}. Pull down to
                refresh.
              </Text>
            )}
          </>
        )}
        {section === "preview" &&
          (selected ? (
            <GamePreview
              game={selected}
              entry={entries.find((e) => e.game.id === selected.id)}
              onSave={() => void save(selected)}
            />
          ) : (
            <ArenaNote>
              Choose a game from Tonight to compare the matchup. The next
              schedule has not reached the feed yet.
            </ArenaNote>
          ))}
        {section === "book" && (
          <SeasonBook
            entries={entries}
            results={results}
            onOpen={openGame}
            onRemove={(id) => void remove(id)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
