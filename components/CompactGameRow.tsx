import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors, getAccessibleTextColor } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { ConfidenceBadge } from './ConfidenceBadge';
import { getRelativeDateLabel } from '../utils/dateLabel';
import type { NHLGameSummary } from '../types/predictions';

interface CompactGameRowProps {
  game: NHLGameSummary;
  prediction: { homeWinProb: number; awayWinProb: number };
  onPress: () => void;
  index: number;
}

function formatGameStatus(game: NHLGameSummary): { text: string; isLive: boolean; isFinal: boolean; score?: string } {
  const state = game.gameState;
  if (state === 'LIVE' || state === 'CRIT') {
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: '', isLive: true, isFinal: false, score: scoreText };
  }
  if (state === 'FINAL' || state === 'OFF') {
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: 'FINAL', isLive: false, isFinal: true, score: scoreText };
  }
  if (game.startTimeUTC) {
    const time = new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { text: time, isLive: false, isFinal: false };
  }
  return { text: 'TBD', isLive: false, isFinal: false };
}

function CompactGameRowComponent({ game, prediction, onPress, index }: CompactGameRowProps) {
  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const confidenceScore = Math.round(Math.abs(prediction.homeWinProb - 50) * 2);
  const favoredAbbrev = prediction.homeWinProb >= prediction.awayWinProb ? homeAbbrev : awayAbbrev;
  const favoredColors = getTeamColors(favoredAbbrev);
  const status = formatGameStatus(game);
  const dateLabel = getRelativeDateLabel(game.gameDate ?? game.startTimeUTC ?? '');

  return (
    <Animated.View entering={FadeInUp.duration(250).delay(index * 40)}>
      <Pressable
        testID={`compact-game-${game.id}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={styles.pressable}
      >
        <View style={[styles.row, { borderLeftColor: favoredColors.primary, borderLeftWidth: 3 }]}>
          {/* Left: Away team */}
          <View style={styles.teamSection}>
            <Image
              source={{ uri: getTeamLogoUrl(awayAbbrev) }}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.abbrev, { color: getAccessibleTextColor(awayAbbrev) }]}>{awayAbbrev}</Text>
          </View>

          {/* Center: @ */}
          <Text style={styles.at}>@</Text>

          {/* Center-right: Home team */}
          <View style={styles.teamSection}>
            <Text style={[styles.abbrev, { color: getAccessibleTextColor(homeAbbrev) }]}>{homeAbbrev}</Text>
            <Image
              source={{ uri: getTeamLogoUrl(homeAbbrev) }}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          {/* Spacer pushes right section to far right */}
          <View style={styles.spacer} />

          {/* Right: Status + Probability */}
          <View style={styles.rightSection}>
            {status.isLive ? (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
                {status.score && <Text style={styles.scoreText}>{status.score}</Text>}
              </View>
            ) : status.isFinal ? (
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>{status.text}</Text>
                {status.score && <Text style={styles.scoreText}>{status.score}</Text>}
              </View>
            ) : (
              <Text style={styles.statusText}>
                {dateLabel !== 'Today' ? `${dateLabel}  ` : ''}{status.text}
              </Text>
            )}
            <View style={styles.probRow}>
              <ConfidenceBadge confidence={confidenceScore} size="sm" />
              <Ionicons name="chevron-forward" size={14} color={theme.subtext} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(CompactGameRowComponent);

const styles = StyleSheet.create({
  pressable: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 65,
    paddingHorizontal: 4,
  },
  teamSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 28,
    height: 28,
  },
  abbrev: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  at: {
    fontSize: 11,
    color: theme.subtext,
    marginHorizontal: 8,
  },
  spacer: {
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22c55e',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    color: theme.subtext,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
