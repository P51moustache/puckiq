import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, Text, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import { makeStyles, insiderTheme } from '../constants/theme';
import type { FactorBreakdownItem } from '../services/modelPrediction';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LockOfTheDayCardProps {
  game: any;
  confidenceScore: number;
  prediction: any;
  onPress?: () => void;
  onLockIn?: () => void;
  isLocked?: boolean;
  situationalFactors?: {
    homeBackToBack: boolean;
    awayBackToBack: boolean;
    homeRestDays: number;
    awayRestDays: number;
    restAdvantage: 'home' | 'away' | 'neutral';
  } | null;
  // Model-related props
  modelName?: string;
  isClassicModel?: boolean;
  factorBreakdown?: FactorBreakdownItem[];
  classicPrediction?: {
    predictedWinnerAbbrev: string;
  } | null;
}

export default function LockOfTheDayCard({
  game,
  confidenceScore,
  prediction,
  onPress,
  onLockIn,
  isLocked = false,
  situationalFactors,
  modelName,
  isClassicModel = true,
  factorBreakdown,
  classicPrediction,
}: LockOfTheDayCardProps) {
  const styles = makeStyles();
  const [isFactorExpanded, setIsFactorExpanded] = useState(false);

  const homeAbbrev = game.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = game.awayTeam?.abbrev || 'AWAY';
  const localTime = game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';

  // Calculate which team is favored
  const favored = prediction.homeWinProb > prediction.awayWinProb ? homeAbbrev : awayAbbrev;
  const favoredProb = Math.max(prediction.homeWinProb, prediction.awayWinProb);

  // Determine confidence level text - Insider language
  let confidenceText = 'ANALYST PICK';
  let confidenceColor = insiderTheme.confidence.moderate;
  if (confidenceScore >= 70) {
    confidenceText = 'THE LOCK';
    confidenceColor = insiderTheme.confidence.lock;
  } else if (confidenceScore >= 60) {
    confidenceText = 'STRONG INTEL';
    confidenceColor = insiderTheme.confidence.strong;
  }

  // Determine situational badges
  const hasSituationalFactors = situationalFactors && (
    situationalFactors.homeBackToBack ||
    situationalFactors.awayBackToBack ||
    situationalFactors.restAdvantage !== 'neutral'
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient
        colors={['#7c3aed', '#3b82f6']}
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
          {/* CLASSIFIED Stamp */}
          <View style={{
            position: 'absolute',
            top: 12,
            right: 12,
            transform: [{ rotate: '12deg' }],
          }}>
            <View style={{
              borderWidth: 2,
              borderColor: insiderTheme.classified.stamp,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              opacity: 0.9,
            }}>
              <Text style={{
                color: insiderTheme.classified.stamp,
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 1.5,
              }}>
                CLASSIFIED
              </Text>
            </View>
          </View>

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
                  🔴 {homeAbbrev} B2B
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
                  🔴 {awayAbbrev} B2B
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
                  💤 {situationalFactors.restAdvantage === 'home' ? homeAbbrev : awayAbbrev} +{Math.abs(situationalFactors.homeRestDays - situationalFactors.awayRestDays)}d rest
                </Text>
              </View>
            )}

            {/* Model Name Badge - only shown if not Classic */}
            {!isClassicModel && modelName && (
              <View style={{
                backgroundColor: '#8b5cf622',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#8b5cf6',
              }}>
                <Text style={{
                  color: '#8b5cf6',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                }}>
                  {modelName}
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
              INSIDER INTEL
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

          {/* Key Factors - Expandable Section */}
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsFactorExpanded(!isFactorExpanded);
            }}
            style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#e6eef8',
                opacity: 0.9,
              }}>
                {factorBreakdown && factorBreakdown.length > 0 ? 'KEY FACTORS' : 'OUR ANALYSTS FOUND'}
              </Text>
              <Text style={{ color: '#60a5fa', fontSize: 12 }}>
                {isFactorExpanded ? '▲' : '▼'}
              </Text>
            </View>

            {/* Summary - always visible (top 3 factors or fallback) */}
            {!isFactorExpanded && (
              <View style={{ marginTop: 10 }}>
                {factorBreakdown && factorBreakdown.length > 0 ? (
                  // Show top 3 factors sorted by absolute impact
                  [...factorBreakdown]
                    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
                    .slice(0, 3)
                    .map((factor, idx) => (
                      <View key={factor.factorKey} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: idx < 2 ? 6 : 0 }}>
                        <Text style={{
                          fontSize: 12,
                          color: factor.impact > 0 ? '#10b981' : factor.impact < 0 ? '#ef4444' : '#98a6bf',
                          marginRight: 6,
                        }}>
                          {factor.impact > 0 ? '▲' : factor.impact < 0 ? '▼' : '•'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#98a6bf', flex: 1 }}>
                          {factor.factorName}: {factor.favoredTeam === 'home' ? homeAbbrev : factor.favoredTeam === 'away' ? awayAbbrev : 'Even'}
                        </Text>
                        <Text style={{
                          fontSize: 11,
                          color: factor.impact > 0 ? '#10b981' : factor.impact < 0 ? '#ef4444' : '#98a6bf',
                          fontWeight: '700',
                        }}>
                          {factor.impact > 0 ? '+' : ''}{factor.impact}
                        </Text>
                      </View>
                    ))
                ) : (
                  // Fallback to static factors
                  ['Strong position in standings', 'Recent form trending up', 'Home ice advantage'].map((factor, idx) => (
                    <Text
                      key={idx}
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: '#98a6bf',
                        marginBottom: idx < 2 ? 6 : 0,
                      }}
                    >
                      • {factor}
                    </Text>
                  ))
                )}
              </View>
            )}

            {/* Expanded - show all factors (top 5) */}
            {isFactorExpanded && factorBreakdown && factorBreakdown.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {[...factorBreakdown]
                  .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
                  .slice(0, 5)
                  .map((factor, idx, arr) => (
                    <View key={factor.factorKey} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                      borderBottomColor: '#192e5e44',
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#e6eef8', marginBottom: 2 }}>
                          {factor.factorName}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#98a6bf' }}>
                          {homeAbbrev}: {factor.homeValue} vs {awayAbbrev}: {factor.awayValue}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: factor.impact > 0 ? '#10b981' : factor.impact < 0 ? '#ef4444' : '#98a6bf',
                        }}>
                          {factor.impact > 0 ? '+' : ''}{factor.impact}
                        </Text>
                        <Text style={{
                          fontSize: 10,
                          color: factor.favoredTeam === 'home' ? '#f59e0b' : factor.favoredTeam === 'away' ? '#60a5fa' : '#98a6bf',
                          fontWeight: '600',
                        }}>
                          {factor.favoredTeam === 'home' ? homeAbbrev : factor.favoredTeam === 'away' ? awayAbbrev : 'EVEN'}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            )}

            {/* Expanded fallback when no breakdown available */}
            {isFactorExpanded && (!factorBreakdown || factorBreakdown.length === 0) && (
              <View style={{ marginTop: 10 }}>
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
                    • {factor}
                  </Text>
                ))}
              </View>
            )}
          </Pressable>

          {/* Classic Model Comparison - show if prediction differs */}
          {!isClassicModel && classicPrediction && classicPrediction.predictedWinnerAbbrev !== favored && (
            <View style={{
              backgroundColor: '#f59e0b22',
              borderRadius: 8,
              padding: 10,
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                Classic would pick: {classicPrediction.predictedWinnerAbbrev}
              </Text>
            </View>
          )}

          {/* Lock In Button or Locked Status */}
          {isLocked ? (
            <View style={{
              backgroundColor: `${insiderTheme.confidence.lock}22`,
              borderRadius: 12,
              padding: 14,
              marginTop: 16,
              borderWidth: 2,
              borderColor: insiderTheme.confidence.lock,
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '900',
                color: insiderTheme.confidence.lock,
                letterSpacing: 0.5,
              }}>
                LOCKED IN ✓
              </Text>
            </View>
          ) : onLockIn ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onLockIn();
              }}
              style={({ pressed }) => ({
                marginTop: 16,
                borderRadius: 12,
                overflow: 'hidden',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <LinearGradient
                colors={[insiderTheme.confidence.lock, '#059669']}
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
                  LOCK IT IN 🔒
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
              GET THE FULL INTEL →
            </Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}
