/**
 * HeatStrip — a tiny horizontal ticker showing every game tonight as a
 * colored slug. Sits between the page title and the hero card.
 *
 * Each cell:
 *   - Width is proportional to model confidence (50% baseline → narrow,
 *     90% → wide). Width range: 24–80px.
 *   - Color is the favored team's primary color.
 *   - On press, scrolls the parent ScrollView to the matching slate row.
 *
 * Visual goal: at-a-glance density. You see your eight-game night as
 * eight bars and immediately know which games the model thinks are
 * spicy vs coin-flips.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { MLPrediction } from '../services/mlPredictions';

interface Game {
  id: number;
  homeTeam?: { abbrev: string; score?: number };
  awayTeam?: { abbrev: string; score?: number };
  startTimeUTC?: string;
  gameState?: string;
}

interface HeatStripProps {
  games: Game[];
  predictions: Record<number, MLPrediction>;
  predictionsMap?: Map<string, { homeWinProb: number; awayWinProb: number }>;
  onPressGame: (gameId: number) => void;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function HeatStrip({ games, predictions, predictionsMap, onPressGame }: HeatStripProps) {
  if (!games?.length) return null;

  return (
    <Animated.View entering={FadeIn.duration(300).delay(150)} style={styles.wrapper}>
      <View style={styles.headerRow}>
        <View style={styles.eyebrowDot} />
        <Text style={styles.eyebrowLabel}>HEAT · {games.length} GAMES</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
      >
        {games.map((g) => {
          const home = g.homeTeam?.abbrev ?? '';
          const away = g.awayTeam?.abbrev ?? '';
          const mlp = predictions[g.id];
          const fb = predictionsMap?.get(`${home}-${away}`) ?? predictionsMap?.get(`${away}-${home}`);
          const homeProb = mlp?.home_win_prob ?? fb?.homeWinProb ?? null;
          const winner = mlp?.predicted_winner ?? (homeProb !== null && homeProb !== undefined ? (homeProb >= 0.5 ? home : away) : null);
          const favoredProb = winner === home ? (homeProb ?? 0.5) : 1 - (homeProb ?? 0.5);
          const colors = winner ? getTeamColors(winner) : null;
          const accent = colors?.primary ?? rinkGlass.textMuted;

          // Bar width from confidence: 50% prob → 26px, 90% prob → 88px
          const widthRange = Math.max(0, Math.min(1, (favoredProb - 0.5) / 0.4));
          const barWidth = 26 + widthRange * 62;
          const intensity = 0.4 + widthRange * 0.6;

          const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT';
          const isFinal = g.gameState === 'OFF' || g.gameState === 'FINAL';

          return (
            <Pressable
              key={g.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPressGame(g.id);
              }}
              style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
            >
              <View style={styles.cellTopRow}>
                <ExpoImage source={{ uri: getTeamLogoUrl(away) }} style={styles.cellLogo} contentFit="contain" />
                <Text style={styles.cellAt}>·</Text>
                <ExpoImage source={{ uri: getTeamLogoUrl(home) }} style={styles.cellLogo} contentFit="contain" />
              </View>
              <View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    backgroundColor: accent,
                    opacity: intensity,
                  },
                ]}
              />
              <Text style={styles.cellMeta}>
                {isLive ? 'LIVE' : isFinal ? 'FINAL' : formatTime(g.startTimeUTC)}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ width: 8 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: rinkGlass.blueLight,
  },
  eyebrowLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.textSecondary,
    letterSpacing: 1.5,
    fontFamily: rinkGlass.fonts.mono,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  cell: {
    minWidth: 80,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: rinkGlass.boards,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'flex-start',
    gap: 3,
  },
  cellPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  cellTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellLogo: {
    width: 14,
    height: 14,
  },
  cellAt: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
  },
  bar: {
    height: 3,
    borderRadius: 1.5,
  },
  cellMeta: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
});
