import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, pickTheme } from '../constants/theme';
import { mediumImpact } from '../utils/haptics';

interface TopPickCardProps {
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

export default function TopPickCard({ game, confidenceScore, prediction, onPress, onConfirmPick, isLocked = false, hasUserPick = false, situationalFactors }: TopPickCardProps) {
  const styles = makeStyles();

  const homeAbbrev = game.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = game.awayTeam?.abbrev || 'AWAY';
  const localTime = game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';

  // Calculate which team is favored
  const favored = prediction.homeWinProb > prediction.awayWinProb ? homeAbbrev : awayAbbrev;
  const favoredProb = Math.max(prediction.homeWinProb, prediction.awayWinProb);

  // Determine confidence level text - Direct language
  let confidenceText = 'GOOD PICK';
  let confidenceColor = pickTheme.confidence.good;
  if (confidenceScore >= 70) {
    confidenceText = 'BEST BET';
    confidenceColor = pickTheme.confidence.bestBet;
  } else if (confidenceScore >= 60) {
    confidenceText = 'SOLID PICK';
    confidenceColor = pickTheme.confidence.solid;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient
        colors={pickTheme.gradients.topPick as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 2,
          marginBottom: 20,
        }}
      >
        <View style={{
          backgroundColor: '#071023',
          borderRadius: 16,
          padding: 20,
        }}>
          {/* Badges Row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {/* Confidence Badge */}
            <View style={{
              backgroundColor: `${confidenceColor}22`,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: confidenceColor,
            }}>
              <Text style={{
                color: confidenceColor,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                {confidenceText}
              </Text>
            </View>

            {/* Back-to-Back Badges */}
            {situationalFactors?.homeBackToBack && (
              <View style={{
                backgroundColor: '#ef444422',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#ef4444',
              }}>
                <Text style={{
                  color: '#ef4444',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                }}>
                  {homeAbbrev} B2B
                </Text>
              </View>
            )}

            {situationalFactors?.awayBackToBack && (
              <View style={{
                backgroundColor: '#ef444422',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#ef4444',
              }}>
                <Text style={{
                  color: '#ef4444',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                }}>
                  {awayAbbrev} B2B
                </Text>
              </View>
            )}

            {/* Rest Advantage Badge */}
            {situationalFactors && situationalFactors.restAdvantage !== 'neutral' && (
              <View style={{
                backgroundColor: '#3b82f622',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#3b82f6',
              }}>
                <Text style={{
                  color: '#3b82f6',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                }}>
                  {situationalFactors.restAdvantage === 'home' ? homeAbbrev : awayAbbrev} +{Math.abs(situationalFactors.homeRestDays - situationalFactors.awayRestDays)}d rest
                </Text>
              </View>
            )}
          </View>

          {/* Matchup */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#e6eef8',
              textAlign: 'center',
              letterSpacing: -0.5,
            }}>
              {awayAbbrev} @ {homeAbbrev}
            </Text>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#60a5fa',
              textAlign: 'center',
              marginTop: 6,
            }}>
              {localTime}
            </Text>
          </View>

          {/* Pick */}
          <View style={{
            backgroundColor: '#192e5e99',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <Text style={{
              fontSize: 13,
              color: '#98a6bf',
              textAlign: 'center',
              marginBottom: 6,
              fontWeight: '600',
            }}>
              OUR PICK
            </Text>
            <Text style={{
              fontSize: 32,
              fontWeight: '900',
              color: '#10b981',
              textAlign: 'center',
              letterSpacing: -1,
            }}>
              {favored}
            </Text>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#e6eef8',
              textAlign: 'center',
              marginTop: 4,
            }}>
              {favoredProb}% Win Probability
            </Text>
          </View>

          {/* Win Probability Breakdown */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8' }}>
                {awayAbbrev}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8' }}>
                {homeAbbrev}
              </Text>
            </View>
            <View style={{
              height: 10,
              backgroundColor: '#192e5e44',
              borderRadius: 5,
              overflow: 'hidden',
              flexDirection: 'row',
            }}>
              <View style={{
                width: `${prediction.awayWinProb}%`,
                backgroundColor: '#60a5fa',
                height: '100%',
              }} />
              <View style={{
                width: `${prediction.homeWinProb}%`,
                backgroundColor: '#f59e0b',
                height: '100%',
              }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#60a5fa' }}>
                {prediction.awayWinProb}%
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>
                {prediction.homeWinProb}%
              </Text>
            </View>
          </View>

          {/* Key Factors */}
          <View style={{
            backgroundColor: '#071a3699',
            borderRadius: 10,
            padding: 14,
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#e6eef8',
              marginBottom: 10,
              opacity: 0.9,
            }}>
              WHY WE LIKE IT
            </Text>
            {['Strong position in standings', 'Recent form trending up', 'Home ice advantage'].map((factor, idx) => (
              <Text
                key={idx}
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: '#98a6bf',
                  marginBottom: idx < 2 ? 6 : 0,
                }}
              >
                {'\u2022'} {factor}
              </Text>
            ))}
          </View>

          {/* Confirm Pick Button or Status */}
          {hasUserPick ? (
            <View style={{
              backgroundColor: `${pickTheme.confidence.bestBet}22`,
              borderRadius: 12,
              padding: 14,
              marginTop: 16,
              borderWidth: 2,
              borderColor: pickTheme.confidence.bestBet,
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '900',
                color: pickTheme.confidence.bestBet,
                letterSpacing: 0.5,
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
                marginTop: 16,
                borderRadius: 12,
                overflow: 'hidden',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <LinearGradient
                colors={[pickTheme.confidence.bestBet, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '900',
                  color: '#fff',
                  letterSpacing: 1,
                }}>
                  CONFIRM PICK
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Text style={{
              fontSize: 11,
              color: '#60a5fa',
              textAlign: 'center',
              marginTop: 14,
              fontWeight: '600',
              opacity: 0.8,
            }}>
              SEE DETAILS
            </Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}
