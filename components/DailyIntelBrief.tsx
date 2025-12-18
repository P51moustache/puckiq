import React from 'react';
import { Text, View } from 'react-native';
import { insiderTheme } from '../constants/theme';

interface DailyIntelBriefProps {
  gamesCount: number;
  locksCount: number;
  selectedTeam?: string | null;
  selectedTeamGameTime?: string | null;
  currentStreak: number;
}

export default function DailyIntelBrief({
  gamesCount,
  locksCount,
  selectedTeam,
  selectedTeamGameTime,
  currentStreak,
}: DailyIntelBriefProps) {
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Get motivational message based on streak
  const getStreakMessage = () => {
    if (currentStreak >= 30) return "You're a legend. Keep it going.";
    if (currentStreak >= 14) return "You're on fire! Don't break the chain.";
    if (currentStreak >= 7) return "Hot streak! The intel is paying off.";
    if (currentStreak >= 3) return "Building momentum. Nice work.";
    if (currentStreak > 0) return "Welcome back, insider.";
    return "Ready to start a streak?";
  };

  return (
    <View style={{
      backgroundColor: insiderTheme.classified.background,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: `${insiderTheme.classified.border}44`,
    }}>
      {/* Header with greeting */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '700',
          color: '#e6eef8',
          marginBottom: 4,
        }}>
          {getGreeting()}, Insider
        </Text>
        <Text style={{
          fontSize: 12,
          color: insiderTheme.classified.text,
          fontWeight: '600',
        }}>
          {getStreakMessage()}
        </Text>
      </View>

      {/* Quick stats row */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#071023',
        borderRadius: 10,
        padding: 12,
        gap: 12,
      }}>
        {/* Games Today */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            fontSize: 24,
            fontWeight: '900',
            color: '#60a5fa',
          }}>
            {gamesCount}
          </Text>
          <Text style={{
            fontSize: 10,
            color: '#98a6bf',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Games Today
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={{
          width: 1,
          backgroundColor: '#334e8d44',
        }} />

        {/* Locks Identified */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            fontSize: 24,
            fontWeight: '900',
            color: insiderTheme.confidence.lock,
          }}>
            {locksCount}
          </Text>
          <Text style={{
            fontSize: 10,
            color: '#98a6bf',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {locksCount === 1 ? 'Lock Found' : 'Locks Found'}
          </Text>
        </View>

        {/* Team Game Time (if applicable) */}
        {selectedTeam && selectedTeamGameTime && (
          <>
            <View style={{
              width: 1,
              backgroundColor: '#334e8d44',
            }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '900',
                color: insiderTheme.engagement.gold,
              }}>
                {selectedTeamGameTime}
              </Text>
              <Text style={{
                fontSize: 10,
                color: '#98a6bf',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {selectedTeam}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
