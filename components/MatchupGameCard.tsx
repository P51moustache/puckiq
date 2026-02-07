import React from 'react';
import { Text, View, Pressable } from 'react-native';
import { makeStyles } from '../constants/theme';
import AnimatedProbabilityBar from './AnimatedProbabilityBar';

export interface GamePrediction {
  homeWinProb: number;
  awayWinProb: number;
  homePoints?: number;
  awayPoints?: number;
  homeRecord?: string;
  awayRecord?: string;
  homeStreak?: string;
  awayStreak?: string;
}

export interface MatchupGameCardProps {
  game: {
    id: string | number;
    homeTeam?: {
      abbrev?: string;
      score?: number;
    };
    awayTeam?: {
      abbrev?: string;
      score?: number;
    };
    startTimeUTC?: string;
    venue?: { default?: string };
    gameState?: string;
    periodDescriptor?: {
      number?: number;
      periodType?: string;
    };
    clock?: {
      timeRemaining?: string;
      inIntermission?: boolean;
    };
  };
  prediction: GamePrediction;
  keyFactors: string[];
  onPress?: () => void;
}

/**
 * Calculate confidence level based on win probability difference
 */
function getConfidenceLevel(prediction: GamePrediction): 'high' | 'medium' | 'low' {
  const diff = Math.abs(prediction.homeWinProb - prediction.awayWinProb);
  if (diff >= 20) return 'high';
  if (diff >= 10) return 'medium';
  return 'low';
}

/**
 * Get status display for a game
 */
function getGameStatus(game: MatchupGameCardProps['game']): {
  text: string;
  isLive: boolean;
  isFinal: boolean;
} {
  const gameState = game.gameState || '';

  if (gameState === 'LIVE' || gameState === 'CRIT') {
    // Show period info for live games
    const period = game.periodDescriptor?.number || 1;
    const periodType = game.periodDescriptor?.periodType;
    const timeRemaining = game.clock?.timeRemaining || '';
    const inIntermission = game.clock?.inIntermission;

    let periodText = `P${period}`;
    if (periodType === 'OT') periodText = 'OT';
    else if (periodType === 'SO') periodText = 'SO';

    if (inIntermission) {
      return { text: `INT ${periodText}`, isLive: true, isFinal: false };
    }

    return {
      text: timeRemaining ? `${periodText} ${timeRemaining}` : 'LIVE',
      isLive: true,
      isFinal: false
    };
  }

  if (gameState === 'FINAL' || gameState === 'OFF') {
    return { text: 'Final', isLive: false, isFinal: true };
  }

  if (gameState === 'FUT' || gameState === 'PRE') {
    return { text: 'Upcoming', isLive: false, isFinal: false };
  }

  return { text: 'Scheduled', isLive: false, isFinal: false };
}

export default function MatchupGameCard({
  game,
  prediction,
  keyFactors,
  onPress
}: MatchupGameCardProps) {
  const styles = makeStyles();

  const homeAbbrev = game.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = game.awayTeam?.abbrev || 'AWAY';
  const homeScore = game.homeTeam?.score;
  const awayScore = game.awayTeam?.score;

  const localTime = game.startTimeUTC
    ? new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  const venue = game.venue?.default || 'TBD';

  const confidence = getConfidenceLevel(prediction);
  const gameStatus = getGameStatus(game);

  // Determine if we should show score or win probability
  const showScore = gameStatus.isLive || gameStatus.isFinal;

  // Confidence styling
  const confidenceStyles = {
    high: { bg: '#10b98122', color: '#10b981', text: '● Strong Pick' },
    medium: { bg: '#f59e0b22', color: '#f59e0b', text: '● Moderate' },
    low: { bg: '#ef444422', color: '#ef4444', text: '● Toss-Up' },
  };
  const currentConfidence = confidenceStyles[confidence];

  // Border color based on confidence
  const borderColor = confidence === 'high' ? '#10b98133' : '#334e8d66';

  // Accessibility label
  const accessibilityLabel = `${awayAbbrev} at ${homeAbbrev}. ${gameStatus.text}. ${
    showScore
      ? `Score: ${awayAbbrev} ${awayScore ?? 0}, ${homeAbbrev} ${homeScore ?? 0}`
      : `${homeAbbrev} has ${prediction.homeWinProb}% win probability`
  }`;

  const CardContent = (
    <View
      style={{
        backgroundColor: styles.card.backgroundColor,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
        width: '100%',
        borderWidth: 2,
        borderColor: gameStatus.isLive ? '#ef4444' : borderColor,
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {/* Header - Teams & Time/Score */}
      <View style={{ marginBottom: 12 }}>
        {showScore ? (
          // Live/Final Score Display
          <View style={{ alignItems: 'center' }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}>
              <View style={{ alignItems: 'center', minWidth: 60 }}>
                <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>
                  {awayAbbrev}
                </Text>
                <Text style={{
                  fontSize: 28,
                  fontWeight: '900',
                  color: (awayScore ?? 0) > (homeScore ?? 0) ? '#10b981' : '#e6eef8',
                  marginTop: 4,
                }}>
                  {awayScore ?? 0}
                </Text>
              </View>

              <Text style={{
                fontSize: 14,
                color: '#98a6bf',
                marginHorizontal: 20,
                fontWeight: '600',
              }}>
                @
              </Text>

              <View style={{ alignItems: 'center', minWidth: 60 }}>
                <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>
                  {homeAbbrev}
                </Text>
                <Text style={{
                  fontSize: 28,
                  fontWeight: '900',
                  color: (homeScore ?? 0) > (awayScore ?? 0) ? '#10b981' : '#e6eef8',
                  marginTop: 4,
                }}>
                  {homeScore ?? 0}
                </Text>
              </View>
            </View>

            <Text style={[styles.subtextSmall, {
              color: gameStatus.isLive ? '#ef4444' : styles.nameAccent.color,
              textAlign: 'center',
              fontSize: 13,
              fontWeight: '700',
              marginTop: 4,
            }]}>
              {gameStatus.text}
            </Text>
          </View>
        ) : (
          // Pre-game Display
          <>
            <Text style={[styles.boxtitle, { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 }]}>
              {awayAbbrev} @ {homeAbbrev}
            </Text>
            <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, textAlign: 'center', fontSize: 13, fontWeight: '600' }]}>
              {localTime} • {gameStatus.text}
            </Text>
          </>
        )}
      </View>

      {/* Win Probability Bar - Only show for pre-game */}
      {!showScore && (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[styles.subtextSmall, { fontSize: 12, fontWeight: '600' }]}>
              {awayAbbrev}: {prediction.awayWinProb}%
            </Text>
            <Text style={[styles.subtextSmall, { fontSize: 12, fontWeight: '600' }]}>
              {homeAbbrev}: {prediction.homeWinProb}%
            </Text>
          </View>

          <AnimatedProbabilityBar
            awayProb={prediction.awayWinProb}
            homeProb={prediction.homeWinProb}
          />

          {/* Confidence Badge */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: currentConfidence.bg,
            }}>
              <Text style={[styles.subtextSmall, {
                fontSize: 11,
                fontWeight: '700',
                color: currentConfidence.color,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }]}>
                {currentConfidence.text}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Records */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 8 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.subtextSmall, { fontSize: 11, marginBottom: 2 }]}>Record</Text>
          <Text style={[styles.boxtitle, { fontSize: 14, fontWeight: '700' }]}>
            {prediction.awayRecord || '0-0-0'}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.subtextSmall, { fontSize: 11, marginBottom: 2 }]}>Record</Text>
          <Text style={[styles.boxtitle, { fontSize: 14, fontWeight: '700' }]}>
            {prediction.homeRecord || '0-0-0'}
          </Text>
        </View>
      </View>

      {/* Key Factors */}
      <View style={{
        backgroundColor: '#071a3699',
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
      }}>
        <Text style={[styles.boxtitle, { fontSize: 12, marginBottom: 8, fontWeight: '700', opacity: 0.9 }]}>
          Key Factors
        </Text>
        {keyFactors.map((factor, idx) => (
          <Text
            key={idx}
            style={[styles.subtextSmall, {
              fontSize: 11,
              lineHeight: 16,
              marginBottom: idx < keyFactors.length - 1 ? 4 : 0,
            }]}
          >
            • {factor}
          </Text>
        ))}
      </View>

      {/* Venue */}
      <Text style={[styles.subtextSmall, { textAlign: 'center', marginTop: 12, fontSize: 11, opacity: 0.7 }]}>
        {venue}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        {CardContent}
      </Pressable>
    );
  }

  return CardContent;
}
