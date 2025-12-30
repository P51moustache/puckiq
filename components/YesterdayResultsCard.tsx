import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';
import { Pick, PickStats } from '../services/pickTracking';
import PickResultModal from './PickResultModal';

interface YesterdayResultsCardProps {
  lock?: Pick;
  smartPicks: Pick[];
  userPicks: Pick[];
  lockStats: PickStats;
  smartPickStats: PickStats;
  userPickStats: PickStats;
}

export default function YesterdayResultsCard({
  lock,
  smartPicks,
  userPicks,
  lockStats,
  smartPickStats,
  userPickStats
}: YesterdayResultsCardProps) {
  const styles = makeStyles();
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handlePickPress = (pick: Pick) => {
    setSelectedPick(pick);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedPick(null);
  };

  // Calculate AI stats (lock + smart picks combined)
  const aiWins = lockStats.wins + smartPickStats.wins;
  const aiLosses = lockStats.losses + smartPickStats.losses;
  const aiTotal = aiWins + aiLosses;
  const aiAccuracy = aiTotal > 0 ? Math.round((aiWins / aiTotal) * 100) : 0;

  // User stats
  const userWins = userPickStats.wins;
  const userLosses = userPickStats.losses;
  const userTotal = userWins + userLosses;
  const userAccuracy = userTotal > 0 ? Math.round((userWins / userTotal) * 100) : 0;

  // Check if there are any picks at all
  const hasAIPicks = lock || smartPicks.length > 0;
  const hasUserPicks = userPicks.length > 0;

  if (!hasAIPicks && !hasUserPicks) return null;

  // Check if any games have completed
  const allPicks = [...(lock ? [lock] : []), ...smartPicks, ...userPicks];
  const completedPicks = allPicks.filter(p => p.outcome);

  if (completedPicks.length === 0) {
    return (
      <View style={{
        backgroundColor: styles.card.backgroundColor,
        borderRadius: 14,
        padding: 16,
        marginBottom: 0,
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '800',
          color: '#e6eef8',
          marginBottom: 8,
        }}>
          Results Pending
        </Text>
        <Text style={{
          fontSize: 12,
          color: '#98a6bf',
          lineHeight: 18,
        }}>
          Games still in progress. Your results are coming soon.
        </Text>
      </View>
    );
  }

  // Determine who won the day
  const userBeatAI = userTotal > 0 && aiTotal > 0 && userAccuracy > aiAccuracy;
  const aiBeatUser = userTotal > 0 && aiTotal > 0 && aiAccuracy > userAccuracy;
  const tied = userTotal > 0 && aiTotal > 0 && userAccuracy === aiAccuracy;

  const getOutcomeColor = (outcome?: 'win' | 'loss' | 'push') => {
    if (outcome === 'win') return '#10b981';
    if (outcome === 'loss') return '#ef4444';
    return '#98a6bf';
  };

  const getOutcomeIcon = (outcome?: 'win' | 'loss' | 'push') => {
    if (outcome === 'win') return '✓';
    if (outcome === 'loss') return '✗';
    return '−';
  };

  return (
    <View style={{
      backgroundColor: styles.card.backgroundColor,
      borderRadius: 14,
      padding: 16,
      marginBottom: 0,
      borderWidth: 1.5,
      borderColor: userBeatAI ? '#10b98155' : (aiBeatUser ? '#60a5fa55' : '#334e8d66'),
    }}>
      {/* Header */}
      <Text style={{
        fontSize: 16,
        fontWeight: '800',
        color: '#e6eef8',
        marginBottom: 12,
      }}>
        Yesterday's Results
      </Text>

      {/* You vs AI Comparison - Main Focus */}
      {hasUserPicks && userTotal > 0 && hasAIPicks && aiTotal > 0 ? (
        <View style={{
          backgroundColor: styles.factbox.backgroundColor,
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* User Stats */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: userBeatAI ? '#10b981' : '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}>
                You
              </Text>
              <Text style={{
                fontSize: 28,
                fontWeight: '900',
                color: userBeatAI ? '#10b981' : '#e6eef8',
              }}>
                {userWins}-{userLosses}
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '700',
                color: userBeatAI ? '#10b981' : '#98a6bf',
                marginTop: 2,
              }}>
                {userAccuracy}%
              </Text>
            </View>

            {/* VS Indicator */}
            <View style={{
              alignItems: 'center',
              paddingHorizontal: 12,
            }}>
              {userBeatAI ? (
                <View style={{
                  backgroundColor: '#10b98122',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: '#10b981',
                  }}>
                    +{userAccuracy - aiAccuracy}%
                  </Text>
                </View>
              ) : aiBeatUser ? (
                <View style={{
                  backgroundColor: '#60a5fa22',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: '#60a5fa',
                  }}>
                    -{aiAccuracy - userAccuracy}%
                  </Text>
                </View>
              ) : (
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#98a6bf',
                }}>
                  TIE
                </Text>
              )}
              <Text style={{
                fontSize: 10,
                color: '#98a6bf',
                marginTop: 4,
              }}>
                vs
              </Text>
            </View>

            {/* AI Stats */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: aiBeatUser ? '#60a5fa' : '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}>
                AI
              </Text>
              <Text style={{
                fontSize: 28,
                fontWeight: '900',
                color: aiBeatUser ? '#60a5fa' : '#e6eef8',
              }}>
                {aiWins}-{aiLosses}
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '700',
                color: aiBeatUser ? '#60a5fa' : '#98a6bf',
                marginTop: 2,
              }}>
                {aiAccuracy}%
              </Text>
            </View>
          </View>

          {/* Result Message */}
          <View style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#334e8d44',
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: userBeatAI ? '#10b981' : (aiBeatUser ? '#60a5fa' : '#98a6bf'),
            }}>
              {userBeatAI ? '🔥 You beat the AI!' :
               aiBeatUser ? '🤖 AI had the edge' :
               '🤝 You matched the AI'}
            </Text>
          </View>
        </View>
      ) : hasUserPicks && userTotal > 0 ? (
        /* User Only Stats */
        <View style={{
          backgroundColor: styles.factbox.backgroundColor,
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <View>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}>
                Your Picks
              </Text>
              <Text style={{
                fontSize: 24,
                fontWeight: '900',
                color: '#e6eef8',
              }}>
                {userWins}-{userLosses}
              </Text>
            </View>
            <View style={{
              alignItems: 'center',
              backgroundColor: `${userAccuracy >= 50 ? '#10b981' : '#ef4444'}22`,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}>
              <Text style={{
                fontSize: 28,
                fontWeight: '900',
                color: userAccuracy >= 50 ? '#10b981' : '#ef4444',
              }}>
                {userAccuracy}%
              </Text>
              <Text style={{
                fontSize: 9,
                color: userAccuracy >= 50 ? '#10b981' : '#ef4444',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                Accuracy
              </Text>
            </View>
          </View>
        </View>
      ) : hasAIPicks && aiTotal > 0 ? (
        /* AI Only Stats */
        <View style={{
          backgroundColor: styles.factbox.backgroundColor,
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <View>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#98a6bf',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}>
                AI Predictions
              </Text>
              <Text style={{
                fontSize: 24,
                fontWeight: '900',
                color: '#e6eef8',
              }}>
                {aiWins}-{aiLosses}
              </Text>
            </View>
            <View style={{
              alignItems: 'center',
              backgroundColor: `${aiAccuracy >= 50 ? '#10b981' : '#ef4444'}22`,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}>
              <Text style={{
                fontSize: 28,
                fontWeight: '900',
                color: aiAccuracy >= 50 ? '#10b981' : '#ef4444',
              }}>
                {aiAccuracy}%
              </Text>
              <Text style={{
                fontSize: 9,
                color: aiAccuracy >= 50 ? '#10b981' : '#ef4444',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                Accuracy
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Lock of the Day Result - Compact */}
      {lock && lock.outcome && (
        <Pressable
          onPress={() => handlePickPress(lock)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#253d6d' : styles.factbox.backgroundColor,
            borderRadius: 10,
            padding: 10,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              backgroundColor: `${getOutcomeColor(lock.outcome)}22`,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '800',
                color: getOutcomeColor(lock.outcome),
              }}>
                {getOutcomeIcon(lock.outcome)}
              </Text>
            </View>
            <Text style={{
              fontSize: 10,
              color: '#fbbf24',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}>
              Lock
            </Text>
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#e6eef8',
            }}>
              {lock.awayTeam} @ {lock.homeTeam}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{
              fontSize: 11,
              color: '#60a5fa',
              fontWeight: '600',
            }}>
              {lock.predictedWinner} → {lock.actualWinner}
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf' }}>›</Text>
          </View>
        </Pressable>
      )}

      {/* User Pick Details - Show individual games */}
      {userPicks.filter(p => p.outcome).length > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={{
            fontSize: 10,
            color: '#98a6bf',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
          }}>
            Your Picks
          </Text>
          {userPicks.filter(p => p.outcome).map((pick, idx) => (
            <Pressable
              key={idx}
              onPress={() => handlePickPress(pick)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#253d6d' : styles.factbox.backgroundColor,
                borderRadius: 8,
                padding: 8,
                marginBottom: 4,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{
                  backgroundColor: `${getOutcomeColor(pick.outcome)}22`,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: getOutcomeColor(pick.outcome),
                  }}>
                    {getOutcomeIcon(pick.outcome)}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#e6eef8',
                }}>
                  {pick.awayTeam} @ {pick.homeTeam}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{
                  fontSize: 11,
                  color: pick.outcome === 'win' ? '#10b981' : '#ef4444',
                  fontWeight: '600',
                }}>
                  {pick.predictedWinner} {pick.outcome === 'win' ? '✓' : '✗'}
                </Text>
                <Text style={{ fontSize: 12, color: '#98a6bf' }}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Pick Result Modal */}
      <PickResultModal
        visible={modalVisible}
        onClose={handleCloseModal}
        pick={selectedPick}
      />
    </View>
  );
}
