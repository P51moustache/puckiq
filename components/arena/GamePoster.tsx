import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { useArena } from "./ArenaProvider";
import { arenaType, ArenaButton } from "./ArenaPrimitives";
import {
  arenaGameHeadline,
  isFinalGame,
  isLiveGame,
} from "../../services/arenaData";
import type { SeasonPhase } from '../../utils/seasonContext';
import { formatFinalScore, getSourceFreshnessStatus } from '../../utils/arenaSlate';
import type { ArenaGame } from "../../types/arena";
import { ArenaSkater } from "./ArenaSkater";
import { ArenaHeadline } from "./ArenaHeadline";

export function gameTime(game: ArenaGame) {
  return new Date(game.start_time_utc).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GamePoster({
  game,
  phase,
  saved,
  onSave,
  onPreview,
}: {
  game: ArenaGame | null;
  phase?: SeasonPhase;
  saved: boolean;
  onSave: () => void;
  onPreview: () => void;
}) {
  const { palette: p, homeTeam } = useArena();
  const { width } = useWindowDimensions();
  const [back, setBack] = useState(false);
  const [reduced, setReduced] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const stamp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    setBack(false);
    flip.setValue(0);
  }, [game?.id, flip]);
  useEffect(() => {
    if (saved && !reduced) {
      stamp.setValue(1.5);
      Animated.spring(stamp, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }).start();
    }
  }, [saved, reduced, stamp]);
  const turn = () => {
    const next = !back;
    setBack(next);
    Animated.timing(flip, {
      toValue: next ? 1 : 0,
      duration: reduced ? 0 : 620,
      useNativeDriver: true,
    }).start();
  };
  const final = game && isFinalGame(game);
  const live = game && isLiveGame(game);
  const finalScore = final && game ? formatFinalScore(game) : null;
  const scheduleUnverified = Boolean(game && !final && !live && getSourceFreshnessStatus(game) === 'unknown');
  const header = !game && phase === 'regular' ? 'GAME\nDESK' : !game && phase === 'playoffs' ? 'CUP\nCHASE' : arenaGameHeadline(game);
  const forecast = game?.forecast;
  const favoriteIsAway = homeTeam?.abbrev === game?.away_team_abbrev;
  const probability = forecast
    ? favoriteIsAway
      ? 1 - forecast.homeProbability
      : forecast.homeProbability
    : null;
  const forecastTeam = game
    ? favoriteIsAway
      ? game.away_team_abbrev
      : game.home_team_abbrev
    : "";
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ height: 442, marginBottom: 15 }}>
        <Animated.View
          accessibilityElementsHidden={back}
          importantForAccessibility={back ? "no-hide-descendants" : "auto"}
          style={[
            styles.face,
            {
              backgroundColor: p.hero,
              borderColor: p.frame,
              transform: [
                { perspective: 1000 },
                {
                  rotateY: flip.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "180deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
          >
            <Defs>
              <Pattern
                id="dots"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <Circle cx="2" cy="2" r="1" fill={p.heroInk} opacity={0.16} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#dots)" />
            <Circle
              cx="290"
              cy="190"
              r="170"
              stroke={p.heroInk}
              strokeWidth="1"
              opacity=".22"
              fill="none"
            />
            <Line
              x1="-40"
              x2="460"
              y1="370"
              y2="150"
              stroke={p.action}
              strokeWidth="24"
              opacity=".8"
            />
          </Svg>
          <View
            style={{
              position: "absolute",
              left: 17,
              top: 18,
              backgroundColor: p.frame,
              borderRadius: 4,
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                fontFamily: arenaType.body,
                color: p.frameInk,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1.3,
              }}
            >
              {final
                ? "FROM THE LAST SLATE"
                : live
                  ? "IN PROGRESS"
                  : scheduleUnverified
                    ? "SCHEDULE UNVERIFIED"
                  : game
                    ? game.game_type === 1
                      ? "PRESEASON"
                      : game.game_type === 3 ? "PLAYOFFS" : "THE MATCHUP"
                    : "YOUR HOME ICE"}
            </Text>
          </View>
          <ArenaSkater
            style={{
              position: "absolute",
              width: 300,
              height: 375,
              right: -45,
              bottom: 51,
            }}
          />
          <ArenaHeadline
            text={header}
            fontSize={width < 380 ? 77 : 88}
            color={p.heroInk}
            textShadowColor={p.hero}
            style={{
              position: "absolute",
              top: 51,
              left: 15,
              transform: [{ rotate: "-4deg" }],
              zIndex: 3,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 20,
              bottom: 102,
              minWidth: 114,
              backgroundColor: p.paper,
              borderColor: p.frame,
              borderWidth: 2,
              paddingHorizontal: 13,
              paddingTop: 10,
              paddingBottom: 8,
              transform: [{ rotate: "-7deg" }],
              zIndex: 4,
            }}
          >
            <Text
              style={{
                fontFamily: arenaType.body,
                color: p.ink,
                fontWeight: "700",
                fontSize: 9,
                letterSpacing: 0.8,
              }}
            >
              {final
                ? "FINAL SCORE"
                : probability !== null
                  ? `${forecastTeam} TO WIN`
                  : "PUCKIQ / CLUB"}
            </Text>
            <Text
              style={{
                fontFamily: arenaType.display,
                fontSize: 45,
                color: p.ink,
              }}
            >
              {final
                ? finalScore
                : probability !== null
                  ? `${Math.round(probability * 100)}%`
                  : (homeTeam?.abbrev ?? "NHL")}
            </Text>
            <Text
              style={{
                fontFamily: arenaType.body,
                color: p.muted,
                fontSize: 9,
              }}
            >
              {final
                ? `${game.away_team_abbrev}  /  ${game.home_team_abbrev}`
                : probability !== null
                  ? "MODEL FORECAST"
                  : "HOCKEY LIVES HERE"}
            </Text>
          </View>
          {saved && (
            <Animated.View
              style={{
                position: "absolute",
                right: 12,
                top: 17,
                padding: 8,
                borderWidth: 3,
                borderColor: "#12613F",
                backgroundColor: "#E4F4E9",
                transform: [{ rotate: "10deg" }, { scale: stamp }],
                zIndex: 6,
              }}
            >
              <Text
                style={{
                  color: "#12613F",
                  fontFamily: arenaType.body,
                  fontWeight: "800",
                  fontSize: 11,
                }}
              >
                BOOKED ✓
              </Text>
            </Animated.View>
          )}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              minHeight: 81,
              backgroundColor: p.frame,
              padding: 16,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: p.frameInk,
                fontFamily: arenaType.display,
                fontSize: 29,
              }}
            >
              {game
                ? `${game.away_team_abbrev}  AT  ${game.home_team_abbrev}`
                : homeTeam
                  ? `${homeTeam.shortName.toUpperCase()} TERRITORY`
                  : "MAKE THIS YOUR HOME ICE"}
            </Text>
            <Text
              style={{
                color: p.frameInk,
                fontFamily: arenaType.body,
                fontSize: 11,
                marginTop: 3,
              }}
            >
              {game
                ? `${gameTime(game)}${game.venue ? `  ·  ${game.venue}` : ""}`
                : "Follow your team. Keep your season."}
            </Text>
          </View>
        </Animated.View>
        <Animated.View
          pointerEvents={back ? "auto" : "none"}
          accessibilityElementsHidden={!back}
          importantForAccessibility={!back ? "no-hide-descendants" : "auto"}
          style={[
            styles.face,
            {
              backgroundColor: p.paper,
              borderColor: p.frame,
              padding: 23,
              transform: [
                { perspective: 1000 },
                {
                  rotateY: flip.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["180deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={{
              fontFamily: arenaType.body,
              color: p.muted,
              fontSize: 10,
              letterSpacing: 2,
            }}
          >
            THE OTHER SIDE OF THE CARD
          </Text>
          <ArenaHeadline
            text={"BEFORE\nTHE BUZZER."}
            fontSize={48}
            color={p.ink}
            style={{ marginTop: 15 }}
          />
          {forecast && game ? (
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  color: p.muted,
                  fontFamily: arenaType.body,
                  fontSize: 10,
                  letterSpacing: 1,
                }}
              >
                {final ? "ARCHIVED MODEL FORECAST" : "MODEL WIN PROBABILITY"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                {[
                  {
                    team: game.away_team_abbrev,
                    probability: 1 - forecast.homeProbability,
                  },
                  {
                    team: game.home_team_abbrev,
                    probability: forecast.homeProbability,
                  },
                ].map((side, index) => (
                  <View
                    key={side.team}
                    style={{ alignItems: index ? "flex-end" : "flex-start" }}
                  >
                    <Text
                      style={{
                        color: p.ink,
                        fontFamily: arenaType.body,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {side.team}
                    </Text>
                    <Text
                      style={{
                        color: p.ink,
                        fontFamily: arenaType.display,
                        fontSize: 43,
                      }}
                    >
                      {Math.round(side.probability * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", height: 10, gap: 4 }}>
                <View
                  style={{
                    flex: Math.max(1 - forecast.homeProbability, 0.001),
                    backgroundColor: p.hero,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: p.edge,
                  }}
                />
                <View
                  style={{
                    flex: Math.max(forecast.homeProbability, 0.001),
                    backgroundColor: p.ink,
                    borderRadius: 4,
                  }}
                />
              </View>
            </View>
          ) : (
            <Text
              style={{
                fontFamily: arenaType.body,
                fontSize: 15,
                color: p.ink,
                lineHeight: 24,
                marginTop: 12,
              }}
            >
              A game is more than the score. Compare the teams, check goalie
              season numbers, and save the card to revisit later.
            </Text>
          )}
          <Text
            style={{
              fontFamily: arenaType.body,
              color: p.muted,
              fontSize: 12,
              lineHeight: 19,
              marginVertical: 17,
            }}
          >
            {forecast
              ? `${forecast.model} · ${forecast.version}\nPublished ${new Date(forecast.predictedAt).toLocaleString()}`
              : "No verified model forecast is available for this card."}
          </Text>
          <View style={{ marginTop: "auto" }}>
            <ArenaButton
              label="Open game preview"
              onPress={onPreview}
              icon="arrow-forward"
              disabled={!game}
            />
          </View>
        </Animated.View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ArenaButton
          label={back ? "Back to the artwork" : "Flip the game card"}
          icon="sync-outline"
          onPress={turn}
          style={{ flex: 1 }}
        />
        <ArenaButton
          label={saved ? "Saved" : "Save"}
          icon={saved ? "bookmark" : "bookmark-outline"}
          onPress={onSave}
          disabled={!game || saved}
          secondary
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPreview}
        disabled={!game}
        style={{
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          marginTop: 6,
        }}
      >
        <Text
          style={{
            color: p.link,
            fontFamily: arenaType.body,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {game
            ? "Goalies, team comparison & forecast changes  →"
            : "The next schedule will appear here when it is available."}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderRadius: 19,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
});
