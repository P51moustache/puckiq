import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Pick } from '../services/pickTracking';

interface GameScore {
  homeScore: number;
  awayScore: number;
  gameState: string;
  periodDescriptor?: { number: number; periodType: string };
}

interface PeriodScore {
  periodNumber: number;
  periodType: string;
  homeScore: number;
  awayScore: number;
}

interface GameDetails {
  periodScores: PeriodScore[];
  homeShots: number;
  awayShots: number;
}

interface PickResultModalProps {
  visible: boolean;
  onClose: () => void;
  pick: Pick | null;
}

// Helper to get pick type label
function getPickTypeLabel(type: Pick['type']): string {
  switch (type) {
    case 'lock':
      return 'Lock of the Day';
    case 'smart-pick':
      return 'Smart Pick';
    case 'user-pick':
      return 'Your Pick';
    default:
      return 'Pick';
  }
}

// Helper to get pick type color
function getPickTypeColor(type: Pick['type']): string {
  switch (type) {
    case 'lock':
      return '#fbbf24'; // Gold
    case 'smart-pick':
      return '#60a5fa'; // Blue
    case 'user-pick':
      return '#10b981'; // Green
    default:
      return '#98a6bf';
  }
}

// Helper to get outcome styling
function getOutcomeDisplay(outcome?: 'win' | 'loss' | 'push'): { label: string; color: string; icon: string } {
  switch (outcome) {
    case 'win':
      return { label: 'Correct', color: '#10b981', icon: '✓' };
    case 'loss':
      return { label: 'Incorrect', color: '#ef4444', icon: '✗' };
    case 'push':
      return { label: 'Push', color: '#98a6bf', icon: '−' };
    default:
      return { label: 'Pending', color: '#98a6bf', icon: '...' };
  }
}

// Helper to parse period scores from landing API response
function parsePeriodScores(
  scoring: any[],
  homeAbbrev: string,
  awayAbbrev: string
): PeriodScore[] {
  if (!scoring || !Array.isArray(scoring)) return [];

  return scoring.map((period: any) => {
    const goals = period.goals || [];
    // Count goals for each team in this period
    const homeGoals = goals.filter(
      (g: any) => g.teamAbbrev?.default === homeAbbrev
    ).length;
    const awayGoals = goals.filter(
      (g: any) => g.teamAbbrev?.default === awayAbbrev
    ).length;

    return {
      periodNumber: period.periodDescriptor?.number || 0,
      periodType: period.periodDescriptor?.periodType || 'REG',
      homeScore: homeGoals,
      awayScore: awayGoals,
    };
  });
}

// Helper to format period label
function getPeriodLabel(periodNumber: number, periodType: string): string {
  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';
  return `${periodNumber}`;
}

export default function PickResultModal({
  visible,
  onClose,
  pick,
}: PickResultModalProps) {
  const [gameScore, setGameScore] = useState<GameScore | null>(null);
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch game score and details when modal opens
  useEffect(() => {
    if (!visible || !pick) {
      setGameScore(null);
      setGameDetails(null);
      setError(null);
      return;
    }

    // Capture pick values for use in async function
    const pickDate = pick.date;
    const pickGameId = pick.gameId;

    async function fetchGameData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch both score and landing (for period breakdown) in parallel
        const [scoreResponse, landingResponse] = await Promise.all([
          fetch(`https://api-web.nhle.com/v1/score/${pickDate}`),
          fetch(`https://api-web.nhle.com/v1/gamecenter/${pickGameId}/landing`),
        ]);

        let homeAbbrev = '';
        let awayAbbrev = '';

        // Process score data
        if (scoreResponse.ok) {
          const scoreData = await scoreResponse.json();
          const games = scoreData.games || [];
          const game = games.find((g: any) => String(g.id) === pickGameId);

          if (game) {
            homeAbbrev = game.homeTeam?.abbrev || '';
            awayAbbrev = game.awayTeam?.abbrev || '';
            setGameScore({
              homeScore: game.homeTeam?.score || 0,
              awayScore: game.awayTeam?.score || 0,
              gameState: game.gameState || 'OFF',
              periodDescriptor: game.periodDescriptor,
            });
          }
        }

        // Process landing data for period breakdown
        if (landingResponse.ok) {
          const landingData = await landingResponse.json();
          const scoring = landingData.summary?.scoring || [];

          // Use abbrevs from landing if not found in score
          if (!homeAbbrev) homeAbbrev = landingData.homeTeam?.abbrev || '';
          if (!awayAbbrev) awayAbbrev = landingData.awayTeam?.abbrev || '';

          const periodScores = parsePeriodScores(scoring, homeAbbrev, awayAbbrev);

          setGameDetails({
            periodScores,
            homeShots: landingData.homeTeam?.sog || 0,
            awayShots: landingData.awayTeam?.sog || 0,
          });
        }
      } catch (err) {
        console.error('[PickResultModal] Error fetching game data:', err);
        setError('Unable to load game data');
      } finally {
        setLoading(false);
      }
    }

    fetchGameData();
  }, [visible, pick]);

  if (!pick) return null;

  const typeColor = getPickTypeColor(pick.type);
  const typeLabel = getPickTypeLabel(pick.type);
  const outcomeDisplay = getOutcomeDisplay(pick.outcome);

  // Determine if the prediction was for home or away team
  const predictedHome = pick.predictedWinner === pick.homeTeam;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: '#0a1628',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '85%',
          maxHeight: '85%',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#192e5e44',
          }}>
            <View>
              <View style={{
                backgroundColor: `${typeColor}22`,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                marginBottom: 8,
                alignSelf: 'flex-start',
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: typeColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  {typeLabel}
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#e6eef8' }}>
                {pick.awayTeam} @ {pick.homeTeam}
              </Text>
              <Text style={{ fontSize: 13, color: '#98a6bf', marginTop: 4 }}>
                {new Date(pick.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Pressable onPress={onClose} style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#192e5e44',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 18, color: '#e6eef8' }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
          >
            {/* Result Banner */}
            <View style={{
              backgroundColor: `${outcomeDisplay.color}15`,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: `${outcomeDisplay.color}40`,
              alignItems: 'center',
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${outcomeDisplay.color}22`,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: outcomeDisplay.color,
                }}>
                  {outcomeDisplay.icon}
                </Text>
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: '800',
                color: outcomeDisplay.color,
                marginBottom: 4,
              }}>
                {outcomeDisplay.label}
              </Text>
              {pick.outcome && (
                <Text style={{
                  fontSize: 13,
                  color: '#98a6bf',
                }}>
                  {pick.outcome === 'win'
                    ? 'The prediction was right!'
                    : pick.outcome === 'loss'
                    ? 'The prediction was wrong'
                    : 'Game ended in a tie'}
                </Text>
              )}
            </View>

            {/* Final Score */}
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                Final Score
              </Text>

              {loading ? (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <ActivityIndicator size="small" color="#60a5fa" />
                  <Text style={{ color: '#98a6bf', marginTop: 8, fontSize: 12 }}>
                    Loading score...
                  </Text>
                </View>
              ) : error ? (
                <Text style={{
                  fontSize: 14,
                  color: '#98a6bf',
                  textAlign: 'center',
                }}>
                  {error}
                </Text>
              ) : gameScore ? (
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  {/* Away Team */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: pick.actualWinner === pick.awayTeam ? '#10b981' : '#e6eef8',
                      marginBottom: 8,
                    }}>
                      {pick.awayTeam}
                    </Text>
                    <Text style={{
                      fontSize: 36,
                      fontWeight: '900',
                      color: pick.actualWinner === pick.awayTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {gameScore.awayScore}
                    </Text>
                    {pick.actualWinner === pick.awayTeam && (
                      <View style={{
                        backgroundColor: '#10b98122',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginTop: 8,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981' }}>
                          WINNER
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Divider */}
                  <View style={{ paddingHorizontal: 16 }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: '#98a6bf',
                    }}>
                      -
                    </Text>
                    {gameScore.periodDescriptor && (
                      <Text style={{
                        fontSize: 10,
                        color: '#98a6bf',
                        marginTop: 4,
                      }}>
                        {gameScore.periodDescriptor.periodType === 'OT' ? 'OT' :
                         gameScore.periodDescriptor.periodType === 'SO' ? 'SO' : 'REG'}
                      </Text>
                    )}
                  </View>

                  {/* Home Team */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: pick.actualWinner === pick.homeTeam ? '#10b981' : '#e6eef8',
                      marginBottom: 8,
                    }}>
                      {pick.homeTeam}
                    </Text>
                    <Text style={{
                      fontSize: 36,
                      fontWeight: '900',
                      color: pick.actualWinner === pick.homeTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {gameScore.homeScore}
                    </Text>
                    {pick.actualWinner === pick.homeTeam && (
                      <View style={{
                        backgroundColor: '#10b98122',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginTop: 8,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981' }}>
                          WINNER
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={{
                  fontSize: 14,
                  color: '#98a6bf',
                  textAlign: 'center',
                }}>
                  Score unavailable
                </Text>
              )}
            </View>

            {/* Period Breakdown */}
            {gameDetails && gameDetails.periodScores.length > 0 && (
              <View style={{
                backgroundColor: '#071a3699',
                borderRadius: 16,
                padding: 20,
                marginBottom: 20,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#98a6bf',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 16,
                  textAlign: 'center',
                }}>
                  Period Breakdown
                </Text>

                {/* Period Header Row */}
                <View style={{
                  flexDirection: 'row',
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#192e5e44',
                }}>
                  <View style={{ width: 50 }} />
                  {gameDetails.periodScores.map((period, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#98a6bf',
                      }}>
                        {getPeriodLabel(period.periodNumber, period.periodType)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: '#98a6bf',
                    }}>
                      T
                    </Text>
                  </View>
                </View>

                {/* Away Team Row */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <View style={{ width: 50 }}>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: pick.actualWinner === pick.awayTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {pick.awayTeam}
                    </Text>
                  </View>
                  {gameDetails.periodScores.map((period, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: period.awayScore > 0 ? '#e6eef8' : '#5a6a8a',
                      }}>
                        {period.awayScore}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: pick.actualWinner === pick.awayTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {gameScore?.awayScore || 0}
                    </Text>
                  </View>
                </View>

                {/* Home Team Row */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <View style={{ width: 50 }}>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: pick.actualWinner === pick.homeTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {pick.homeTeam}
                    </Text>
                  </View>
                  {gameDetails.periodScores.map((period, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: period.homeScore > 0 ? '#e6eef8' : '#5a6a8a',
                      }}>
                        {period.homeScore}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: pick.actualWinner === pick.homeTeam ? '#10b981' : '#e6eef8',
                    }}>
                      {gameScore?.homeScore || 0}
                    </Text>
                  </View>
                </View>

                {/* Game Stats */}
                <View style={{
                  borderTopWidth: 1,
                  borderTopColor: '#192e5e44',
                  paddingTop: 12,
                }}>
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 12,
                      color: '#98a6bf',
                    }}>
                      Shots on Goal
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: '#e6eef8',
                    }}>
                      {gameDetails.awayShots} - {gameDetails.homeShots}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* AI Prediction Section */}
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 16,
              }}>
                {pick.type === 'user-pick' ? 'Your Prediction' : 'AI Prediction'}
              </Text>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    backgroundColor: `${typeColor}22`,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color: typeColor,
                    }}>
                      {pick.predictedWinner}
                    </Text>
                  </View>
                  <View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#e6eef8',
                    }}>
                      {pick.predictedWinner} to win
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: '#98a6bf',
                    }}>
                      {predictedHome ? 'Home team' : 'Away team'}
                    </Text>
                  </View>
                </View>

                {/* Outcome indicator */}
                <View style={{
                  backgroundColor: `${outcomeDisplay.color}22`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: outcomeDisplay.color,
                  }}>
                    {outcomeDisplay.icon} {outcomeDisplay.label}
                  </Text>
                </View>
              </View>

              {/* Prediction Bar (show when win probabilities are available) */}
              {pick.homeWinProb !== undefined && pick.awayWinProb !== undefined && (
                <View style={{
                  borderTopWidth: 1,
                  borderTopColor: '#192e5e44',
                  paddingTop: 16,
                }}>
                  <Text style={{
                    fontSize: 11,
                    color: '#98a6bf',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 12,
                    textAlign: 'center',
                  }}>
                    AI Win Probability
                  </Text>
                  {/* Team labels with percentages */}
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: '#60a5fa',
                      }}>
                        {pick.awayTeam}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#60a5fa',
                        marginLeft: 6,
                      }}>
                        {pick.awayWinProb}%
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#f59e0b',
                        marginRight: 6,
                      }}>
                        {pick.homeWinProb}%
                      </Text>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: '#f59e0b',
                      }}>
                        {pick.homeTeam}
                      </Text>
                    </View>
                  </View>
                  {/* Prediction Bar */}
                  <View style={{
                    height: 10,
                    backgroundColor: '#192e5e',
                    borderRadius: 5,
                    overflow: 'hidden',
                    flexDirection: 'row',
                  }}>
                    <View style={{
                      width: `${pick.awayWinProb}%`,
                      height: '100%',
                      backgroundColor: '#60a5fa',
                    }} />
                    <View style={{
                      width: `${pick.homeWinProb}%`,
                      height: '100%',
                      backgroundColor: '#f59e0b',
                    }} />
                  </View>
                </View>
              )}
            </View>

            {/* What Happened Summary */}
            {pick.outcome && pick.actualWinner && (
              <View style={{
                backgroundColor: '#071a3699',
                borderRadius: 16,
                padding: 20,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#98a6bf',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12,
                }}>
                  Summary
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#c9d4e8',
                  lineHeight: 22,
                }}>
                  {pick.outcome === 'win' ? (
                    <>
                      The prediction of <Text style={{ fontWeight: '700', color: typeColor }}>{pick.predictedWinner}</Text> winning was correct! {pick.actualWinner} won the game
                      {gameScore && ` with a score of ${gameScore.awayScore}-${gameScore.homeScore}`}.
                    </>
                  ) : (
                    <>
                      <Text style={{ fontWeight: '700', color: typeColor }}>{pick.predictedWinner}</Text> was predicted to win, but <Text style={{ fontWeight: '700', color: '#10b981' }}>{pick.actualWinner}</Text> won instead
                      {gameScore && ` with a score of ${gameScore.awayScore}-${gameScore.homeScore}`}.
                    </>
                  )}
                </Text>
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
