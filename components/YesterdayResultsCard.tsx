import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';
import { Pick, PickStats } from '../services/pickTracking';

interface YesterdayResultsCardProps {
  lock?: Pick;
  smartPicks: Pick[];
  lockStats: PickStats;
  smartPickStats: PickStats;
}

export default function YesterdayResultsCard({ lock, smartPicks, lockStats, smartPickStats }: YesterdayResultsCardProps) {
  const styles = makeStyles();

  // If no picks were made yesterday, don't show anything
  if (!lock && smartPicks.length === 0) return null;

  // Calculate overall stats
  const allPicks = [...(lock ? [lock] : []), ...smartPicks];
  const completedPicks = allPicks.filter(p => p.outcome);

  // If no games have completed yet, show pending state
  if (completedPicks.length === 0) {
    return (
      <View style={{
        backgroundColor: styles.card.backgroundColor,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '800',
          color: '#e6eef8',
          marginBottom: 8,
        }}>
          Yesterday's Picks
        </Text>
        <Text style={{
          fontSize: 12,
          color: '#98a6bf',
          lineHeight: 18,
        }}>
          Games still in progress. Check back soon for results.
        </Text>
      </View>
    );
  }

  const totalWins = lockStats.wins + smartPickStats.wins;
  const totalLosses = lockStats.losses + smartPickStats.losses;
  const overallAccuracy = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

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
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: overallAccuracy >= 60 ? '#10b98133' : '#334e8d66',
    }}>
      {/* Header */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '800',
          color: '#e6eef8',
          marginBottom: 4,
        }}>
          Yesterday's Results
        </Text>
        <Text style={{
          fontSize: 11,
          color: '#98a6bf',
        }}>
          {totalWins}-{totalLosses} • {overallAccuracy}% accuracy
        </Text>
      </View>

      {/* Lock of the Day Result */}
      {lock && lock.outcome && (
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
          borderLeftWidth: 3,
          borderLeftColor: getOutcomeColor(lock.outcome),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{
              fontSize: 10,
              color: '#98a6bf',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              Lock of the Day
            </Text>
            <View style={{
              backgroundColor: `${getOutcomeColor(lock.outcome)}22`,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '800',
                color: getOutcomeColor(lock.outcome),
              }}>
                {getOutcomeIcon(lock.outcome)}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: getOutcomeColor(lock.outcome),
                textTransform: 'uppercase',
              }}>
                {lock.outcome}
              </Text>
            </View>
          </View>
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#e6eef8',
            marginBottom: 2,
          }}>
            {lock.awayTeam} @ {lock.homeTeam}
          </Text>
          <Text style={{
            fontSize: 11,
            color: '#60a5fa',
          }}>
            Picked: {lock.predictedWinner} • Winner: {lock.actualWinner}
          </Text>
        </View>
      )}

      {/* Smart Picks Summary */}
      {smartPicks.length > 0 && smartPickStats.total > 0 && (
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 10,
          padding: 12,
        }}>
          <Text style={{
            fontSize: 10,
            color: '#98a6bf',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}>
            Smart Picks
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{
                fontSize: 20,
                fontWeight: '900',
                color: '#e6eef8',
              }}>
                {smartPickStats.wins}-{smartPickStats.losses}
              </Text>
              <Text style={{
                fontSize: 10,
                color: '#98a6bf',
              }}>
                {smartPickStats.total} games completed
              </Text>
            </View>
            <View style={{
              alignItems: 'center',
              backgroundColor: `${smartPickStats.accuracy >= 60 ? '#10b981' : '#ef4444'}22`,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: '900',
                color: smartPickStats.accuracy >= 60 ? '#10b981' : '#ef4444',
              }}>
                {smartPickStats.accuracy}%
              </Text>
              <Text style={{
                fontSize: 9,
                color: smartPickStats.accuracy >= 60 ? '#10b981' : '#ef4444',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                Accuracy
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
