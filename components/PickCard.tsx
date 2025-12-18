import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, pickTheme } from '../constants/theme';
import { mediumImpact } from '../utils/haptics';

interface PickCardProps {
  game: any;
  confidenceScore: number;
  prediction: any;
  onPress?: () => void;
  onConfirmPick?: () => void;
  isLocked?: boolean;
  hasUserPick?: boolean;
  situationalFactors?: {
    homeBackToBack: boolean;
    awayBackToBack: boolean;
    homeRestDays: number;
    awayRestDays: number;
    restAdvantage: 'home' | 'away' | 'neutral';
  } | null;
}

export default function PickCard({ game, confidenceScore, prediction, onPress, onConfirmPick, isLocked = false, hasUserPick = false, situationalFactors }: PickCardProps) {
  const styles = makeStyles();

  const homeAbbrev = game.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = game.awayTeam?.abbrev || 'AWAY';
  const localTime = game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';

  // Calculate which team is favored
  const favored = prediction.homeWinProb > prediction.awayWinProb ? homeAbbrev : awayAbbrev;

  // Determine confidence badge - Direct language
  let confidenceBadge = 'GOOD PICK';
  let badgeColor = pickTheme.confidence.good;
  if (confidenceScore >= 65) {
    confidenceBadge = 'TRENDING';
    badgeColor = pickTheme.confidence.solid;
  } else if (confidenceScore < 55) {
    confidenceBadge = 'TOSS-UP';
    badgeColor = pickTheme.confidence.tossUp;
  }

  // Check for situational factors
  const hasBackToBack = situationalFactors?.homeBackToBack || situationalFactors?.awayBackToBack;
  const hasRestAdvantage = situationalFactors && situationalFactors.restAdvantage !== 'neutral';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, width: '48%' })}>
      <View style={{
        backgroundColor: styles.card.backgroundColor,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#334e8d66',
      }}>
        {/* Badges Row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {/* Confidence Badge */}
          <View style={{
            backgroundColor: `${badgeColor}22`,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: `${badgeColor}66`,
          }}>
            <Text style={{
              color: badgeColor,
              fontSize: 9,
              fontWeight: '800',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {confidenceBadge}
            </Text>
          </View>

          {/* Situational Factor Badges (compact) */}
          {hasBackToBack && (
            <View style={{
              backgroundColor: '#ef444422',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#ef444466',
            }}>
              <Text style={{
                color: '#ef4444',
                fontSize: 8,
                fontWeight: '800',
              }}>
                B2B
              </Text>
            </View>
          )}

          {hasRestAdvantage && (
            <View style={{
              backgroundColor: '#3b82f622',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#3b82f666',
            }}>
              <Text style={{
                color: '#3b82f6',
                fontSize: 8,
                fontWeight: '800',
              }}>
                REST
              </Text>
            </View>
          )}
        </View>

        {/* Matchup */}
        <Text style={{
          fontSize: 16,
          fontWeight: '800',
          color: '#e6eef8',
          textAlign: 'center',
          marginBottom: 6,
        }}>
          {awayAbbrev} @ {homeAbbrev}
        </Text>

        <Text style={{
          fontSize: 11,
          fontWeight: '600',
          color: '#60a5fa',
          textAlign: 'center',
          marginBottom: 10,
        }}>
          {localTime}
        </Text>

        {/* Pick */}
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 8,
          padding: 10,
          marginBottom: 10,
        }}>
          <Text style={{
            fontSize: 10,
            color: '#98a6bf',
            textAlign: 'center',
            marginBottom: 3,
            fontWeight: '600',
          }}>
            OUR PICK
          </Text>
          <Text style={{
            fontSize: 20,
            fontWeight: '900',
            color: '#10b981',
            textAlign: 'center',
          }}>
            {favored}
          </Text>
          <Text style={{
            fontSize: 11,
            fontWeight: '600',
            color: '#e6eef8',
            textAlign: 'center',
            marginTop: 3,
          }}>
            {Math.max(prediction.homeWinProb, prediction.awayWinProb)}%
          </Text>
        </View>

        {/* Key Factors (compact) */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{
            fontSize: 10,
            lineHeight: 14,
            color: '#98a6bf',
            marginBottom: 3,
          }}>
            {'\u2022'} {prediction.homeStreak?.startsWith('W') ? `${homeAbbrev} hot` : 'Home ice'}
          </Text>
          <Text style={{
            fontSize: 10,
            lineHeight: 14,
            color: '#98a6bf',
          }}>
            {'\u2022'} {favored} favored
          </Text>
        </View>

        {/* Confirm Button or Status */}
        {hasUserPick ? (
          <View style={{
            backgroundColor: `${pickTheme.confidence.bestBet}22`,
            borderRadius: 8,
            padding: 8,
            marginTop: 8,
            borderWidth: 1.5,
            borderColor: pickTheme.confidence.bestBet,
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 10,
              fontWeight: '800',
              color: pickTheme.confidence.bestBet,
            }}>
              PICK CONFIRMED
            </Text>
          </View>
        ) : isLocked ? null : onConfirmPick ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              mediumImpact();
              onConfirmPick();
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? pickTheme.confidence.bestBet : `${pickTheme.confidence.bestBet}22`,
              borderRadius: 8,
              padding: 8,
              marginTop: 8,
              borderWidth: 1.5,
              borderColor: pickTheme.confidence.bestBet,
              alignItems: 'center',
            })}
          >
            <Text style={{
              fontSize: 10,
              fontWeight: '800',
              color: pickTheme.confidence.bestBet,
            }}>
              CONFIRM
            </Text>
          </Pressable>
        ) : (
          <Text style={{
            fontSize: 9,
            color: '#60a5fa',
            textAlign: 'center',
            marginTop: 4,
            fontWeight: '600',
            opacity: 0.7,
          }}>
            DETAILS
          </Text>
        )}
      </View>
    </Pressable>
  );
}
