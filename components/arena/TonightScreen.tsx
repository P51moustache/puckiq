import { useLocalSearchParams } from 'expo-router';
import { parseEntityId } from '../../utils/entityRoutes';
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
  fetchArenaGameById,
  applyGameFreshness,
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
import { resolveSeasonContext } from '../../utils/seasonContext';
import { SeasonClubhouse, SeasonGuide, SeasonIdentity } from './SeasonHub';
import { PlayoffSeries } from './PlayoffSeries';
import {
  formatFinalScore,
  getSourceFreshnessStatus,
  selectArchiveGames,
  selectCurrentArenaGames,
} from '../../utils/arenaSlate';
import type { ArenaGame, SeasonEntry } from "../../types/arena";

export default function TonightScreen() {
  const params = useLocalSearchParams<{ game?: string | string[]; previewSeason?: string }>();
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
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
  const selectionRequest = useRef(0);
  const ordered = useMemo(
    () => orderArenaGames(games, homeTeam?.abbrev),
    [games, homeTeam?.abbrev],
  );
  const seasonContext = resolveSeasonContext(games);
  const previewPhase = __DEV__ && ['offseason','preseason','regular','playoffs'].includes(params.previewSeason ?? '') ? params.previewSeason as typeof seasonContext.phase : null;
  const phase = previewPhase ?? seasonContext.phase;
  const lowSeason = phase === 'offseason' || phase === 'preseason';
  const [showArchive, setShowArchive] = useState(false);
  const currentGames = selectCurrentArenaGames(ordered, new Date(), seasonContext.season);
  const unarchivedGames = lowSeason ? currentGames.filter(game => !isFinalGame(game)) : currentGames;
  const archiveGames = selectArchiveGames(ordered);
  const hasArchive = archiveGames.length > 0;
  const visibleGames = showArchive ? archiveGames : unarchivedGames;
  const featured = currentGames[0] ?? null;
  const selected =
    games.find((g) => g.id === selection?.id) ?? (selection ? applyGameFreshness(selection) : featured);
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
    const requestId = ++selectionRequest.current;
    setSelection(game);
    setSection("preview");
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (games.some(loaded => loaded.id === game.id)) {
      setRouteMessage(null);
      return;
    }
    // Series/history rows do not include the forecast; resolve full context first.
    setRouteMessage('Loading selected game…');
    void fetchArenaGameById(game.id).then(next => {
      if (selectionRequest.current !== requestId) return;
      setSelection(next);
      setRouteMessage(next ? null : 'This game is unavailable in the feed. Choose a game from Home.');
    }).catch(() => {
      if (selectionRequest.current === requestId) setRouteMessage('The selected game could not be loaded. Return to Home and try again.');
    });
  };
  useEffect(() => {
    if (params.game === undefined) return;
    let alive = true;
    const requestId = ++selectionRequest.current;
    setSection('preview'); setSelection(null);
    const id = parseEntityId(params.game);
    setRouteMessage(id ? 'Loading selected game…' : 'Game unavailable: this link has an invalid game ID. Choose a game from Home.');
    if (id) void fetchArenaGameById(id).then(game => {
      if (!alive || selectionRequest.current !== requestId) return;
      setSelection(game);
      setRouteMessage(game ? null : 'This game is unavailable in the feed. Choose a game from Home.');
    }).catch(() => { if (alive && selectionRequest.current === requestId) setRouteMessage('The selected game could not be loaded. Return to Home and try again.'); });
    return () => { alive = false; };
  }, [params.game]);
  const upcoming = visibleGames.some((g) => !isFinalGame(g));
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
                {["Home", "Game preview", "Season book"][i]}
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
            {!upcoming && !loading && !lowSeason && (
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
                  {hasArchive
                    ? "Open the game archive below for earlier results."
                    : "Your next matchup will appear here."}
                </Text>
              </View>
            )}
            <SeasonIdentity phase={phase} label={previewPhase ? `Design preview / ${previewPhase}` : seasonContext.label} note={previewPhase ? 'Development preview. Game data remains the real feed.' : seasonContext.note} estimated={!previewPhase && seasonContext.confidence === 'calendar'} />
            {lowSeason ? <SeasonClubhouse phase={phase as 'offseason' | 'preseason'} season={seasonContext.season} onBook={() => setSection('book')} /> : <GamePoster
              phase={phase}
              game={featured}
              saved={entries.some((e) => e.game.id === featured?.id)}
              onSave={() => {
                if (featured) void save(featured);
              }}
              onPreview={() => {
                if (featured) openGame(featured);
              }}
            />}
            {phase === 'playoffs' && featured?.game_type === 3 && <PlayoffSeries game={featured} onOpen={openGame} />}
            {lowSeason && !visibleGames.length && <Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 8 }}>The next schedule isn’t available here yet. Your watchlist and saved season are ready to use.</Text>}
            {lowSeason && seasonContext.nextGame && <Pressable accessibilityRole="button" onPress={() => openGame(seasonContext.nextGame!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginTop: 14, borderWidth: 1.5, borderColor: p.edge, borderRadius: 14, backgroundColor: p.paper }}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 10 }}>Next on the league calendar</Text><Text style={{ fontFamily: arenaType.display, color: p.ink, fontSize: 27, marginTop: 2 }}>{seasonContext.nextGame.away_team_abbrev} / {seasonContext.nextGame.home_team_abbrev}</Text><Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 11 }}>{gameTime(seasonContext.nextGame)}</Text></View>
              <Text style={{ fontFamily: arenaType.display, color: p.link, fontSize: 33 }}>{seasonContext.daysUntilNextGame === 0 ? 'TODAY' : `${seasonContext.daysUntilNextGame}D`}</Text>
            </Pressable>}
            <SeasonGuide phase={phase} onBook={() => setSection('book')} />
            {(hasArchive || showArchive) && <Pressable accessibilityRole="button" onPress={() => setShowArchive(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontFamily: arenaType.body, fontWeight: '700', color: p.link, fontSize: 12 }}>{showArchive ? 'Close game archive' : 'Revisit the game archive'}</Text></Pressable>}
            {showArchive && <ArenaNote>Archive shows completed games whose feed scores are present. Coverage may be incomplete; games without valid final scores are omitted.</ArenaNote>}
            {!!visibleGames.length && <View
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
                {showArchive ? "FROM THE ARCHIVE" : upcoming ? "NEXT ON THE ICE" : "RECENT GAMES"}
              </Text>
              <Text
                style={{
                  fontFamily: arenaType.body,
                  fontSize: 10,
                  color: p.muted,
                }}
              >
                {visibleGames.length} GAMES
              </Text>
            </View>}
            {visibleGames.map((game) => (
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
                      ? formatFinalScore(game)
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
                        : getSourceFreshnessStatus(game) === 'unknown'
                          ? "SCHEDULE UNVERIFIED"
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
          (routeMessage ? <ArenaNote>{routeMessage}</ArenaNote> : selected ? (
            <GamePreview
              game={selected}
              entry={entries.find((e) => e.game.id === selected.id)}
              onSave={() => void save(selected)}
            />
          ) : (
            <ArenaNote>
              Choose a game from Home to compare the matchup. The next
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
