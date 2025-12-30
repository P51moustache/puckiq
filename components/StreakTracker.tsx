import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';

interface StreakTrackerProps {
  streakingTeams: {
    hot: any[];
    cold: any[];
  };
}

export default function StreakTracker({ streakingTeams }: StreakTrackerProps) {
  const styles = makeStyles();

  const { hot, cold } = streakingTeams;

  if ((!hot || hot.length === 0) && (!cold || cold.length === 0)) return null;

  const renderStreakCard = (team: any, type: 'hot' | 'cold') => {
    const streak = team.streakCode || '';
    const streakNum = parseInt(streak.substring(1)) || 0;
    const goalDiff = (team.goalFor || 0) - (team.goalAgainst || 0);

    const bgColor = type === 'hot' ? '#10b98122' : '#3b82f622';
    const borderColor = type === 'hot' ? '#10b981' : '#3b82f6';
    const textColor = type === 'hot' ? '#10b981' : '#3b82f6';
    const emoji = type === 'hot' ? '🔥' : '❄️';

    return (
      <View
        key={team.teamAbbrev?.default || team.teamAbbrev}
        style={{
          backgroundColor: bgColor,
          borderWidth: 1.5,
          borderColor,
          borderRadius: 12,
          padding: 12,
          marginRight: 10,
          minWidth: 140,
        }}
      >
        {/* Team & Emoji */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: '#e6eef8',
          }}>
            {team.teamAbbrev?.default || team.teamAbbrev}
          </Text>
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </View>

        {/* Streak */}
        <View style={{
          backgroundColor: `${borderColor}33`,
          borderRadius: 8,
          padding: 6,
          marginBottom: 6,
        }}>
          <Text style={{
            fontSize: 11,
            color: textColor,
            fontWeight: '700',
            textAlign: 'center',
          }}>
            {streakNum} GAME {type === 'hot' ? 'WIN' : 'LOSS'} STREAK
          </Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 10, color: '#98a6bf', marginBottom: 2 }}>Record</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#e6eef8' }}>
              {team.wins}-{team.losses}-{team.otLosses || 0}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: '#98a6bf', marginBottom: 2 }}>Goal Diff</Text>
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: goalDiff > 0 ? '#10b981' : goalDiff < 0 ? '#ef4444' : '#98a6bf'
            }}>
              {goalDiff > 0 ? '+' : ''}{goalDiff}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ marginTop: 24, marginBottom: 0 }}>
      {/* Hot Streaks */}
      {hot && hot.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: '#e6eef8',
            marginBottom: 10,
            marginLeft: 16,
          }}>
            Hot Teams
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {hot.map(team => renderStreakCard(team, 'hot'))}
          </ScrollView>
        </View>
      )}

      {/* Cold Streaks */}
      {cold && cold.length > 0 && (
        <View>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: '#e6eef8',
            marginBottom: 10,
            marginLeft: 16,
          }}>
            Cold Teams
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {cold.map(team => renderStreakCard(team, 'cold'))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
