import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { ConfidenceBadge } from './ConfidenceBadge';

interface YourTeamCardProps {
  game: any;
  prediction: { homeWinProb: number; awayWinProb: number };
  selectedTeam: string;
  confidenceScore: number;
  onPress: () => void;
  onShare?: () => void;
  nextGame?: { opponent: string; date: string; time: string } | null;
}

function formatGameTime(game: any): string {
  const state = game.gameState;
  if (state === 'LIVE' || state === 'CRIT') {
    const period = game.period ?? '';
    const clock = game.clock?.timeRemaining ?? '';
    const periodLabel = period <= 3 ? `P${period}` : 'OT';
    return `LIVE ${periodLabel} ${clock}`.trim();
  }
  if (state === 'FINAL' || state === 'OFF') {
    return `FINAL ${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
  }
  if (game.startTimeUTC) {
    return new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return 'TBD';
}

export default function YourTeamCard({
  game,
  prediction,
  selectedTeam,
  confidenceScore,
  onPress,
  onShare,
  nextGame,
}: YourTeamCardProps) {
  // If no game but have next game info, show compact "next game" row
  if (!game && nextGame) {
    return (
      <Animated.View entering={FadeInUp.duration(300)} style={styles.nextGameRow}>
        <Image
          source={{ uri: getTeamLogoUrl(selectedTeam) }}
          style={styles.logoSmall}
          contentFit="contain"
        />
        <Text style={styles.nextGameText}>
          Next: {selectedTeam} vs {nextGame.opponent} | {nextGame.date} {nextGame.time}
        </Text>
      </Animated.View>
    );
  }

  if (!game) return null;

  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const isHome = homeAbbrev === selectedTeam;
  const opponentAbbrev = isHome ? awayAbbrev : homeAbbrev;
  const teamColors = getTeamColors(selectedTeam);
  const gameTime = formatGameTime(game);
  const isLive = game.gameState === 'LIVE' || game.gameState === 'CRIT';

  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const teamIsFavored = (isHome && favoredIsHome) || (!isHome && !favoredIsHome);
  const teamWinProb = isHome ? prediction.homeWinProb : prediction.awayWinProb;

  return (
    <Animated.View entering={FadeInUp.duration(300)}>
      <Pressable
        testID="your-team-card"
        onPress={() => { if (Platform.OS === 'ios' || Platform.OS === 'android') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        style={({ pressed }) => [
          styles.card,
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <LinearGradient
          colors={[
            `${teamColors.primary}22`,
            'transparent',
            `${teamColors.primary}10`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Team color accent strip */}
        <View style={[styles.accentStrip, { backgroundColor: teamColors.primary }]} />

        <View style={styles.content}>
          {/* Left: Logo + Matchup + Time */}
          <View style={styles.leftGroup}>
            <Image source={{ uri: getTeamLogoUrl(awayAbbrev) }} style={styles.logo} contentFit="contain" />
            <Text style={styles.matchup}>
              {awayAbbrev} @ {homeAbbrev}
            </Text>
            <Image source={{ uri: getTeamLogoUrl(homeAbbrev) }} style={styles.logo} contentFit="contain" />
            <Text style={[styles.time, isLive && styles.timeLive]}>
              {gameTime}
            </Text>
          </View>

          {/* Right: Prediction + Badge + Tag */}
          <View style={styles.rightGroup}>
            <Text style={styles.predText}>
              {Math.round(teamWinProb)}%
            </Text>
            <ConfidenceBadge confidence={confidenceScore} size="sm" />
            <View style={[styles.yourTeamTag, { borderColor: teamColors.primary }]}>
              <Text style={[styles.yourTeamText, { color: teamColors.primary }]}>YOUR TEAM</Text>
            </View>
            {onShare && (
              <Pressable onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={14} color={theme.subtext} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  accentStrip: {
    width: 3,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  logo: {
    width: 20,
    height: 20,
  },
  logoSmall: {
    width: 24,
    height: 24,
  },
  matchup: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginLeft: 4,
  },
  timeLive: {
    color: '#22c55e',
    fontWeight: '700',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  predText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  yourTeamTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  yourTeamText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nextGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  nextGameText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
  },
});
