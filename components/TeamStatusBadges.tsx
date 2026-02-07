import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export interface TeamBadge {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  description: string;
}

interface TeamStatusBadgesProps {
  teamStats: any; // Team stats from API
  standings?: any; // Standings data
}

export default function TeamStatusBadges({ teamStats, standings }: TeamStatusBadgesProps) {
  const badges = getTeamBadges(teamStats, standings);

  if (badges.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Team Status</Text>
      <View style={styles.badgeGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={[styles.badge, { borderColor: badge.color }]}>
            <Ionicons name={badge.icon} size={16} color={badge.color} />
            <Text style={styles.badgeLabel}>{badge.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Determine which badges a team has earned
function getTeamBadges(teamStats: any, standings?: any): TeamBadge[] {
  const badges: TeamBadge[] = [];

  if (!teamStats) return badges;

  const {
    wins = 0,
    losses = 0,
    streakCode = '',
    goalsFor = 0,
    goalsAgainst = 0,
    gamesPlayed = 1,
    last10Wins = 0,
    last10Losses = 0,
  } = teamStats;

  // Calculate metrics
  const goalsPerGame = goalsFor / gamesPlayed;
  const goalsAgainstPerGame = goalsAgainst / gamesPlayed;
  const goalDifferential = goalsFor - goalsAgainst;
  const winPct = wins / (wins + losses);

  // Parse streak
  const streakNum = parseInt(streakCode?.replace(/[A-Z]/g, '') || '0');
  const isWinStreak = streakCode?.includes('W');
  const isLossStreak = streakCode?.includes('L');

  // 🔥 ON FIRE - 5+ game win streak
  if (isWinStreak && streakNum >= 5) {
    badges.push({
      id: 'on_fire',
      icon: 'flame',
      label: 'On Fire',
      color: '#ef4444',
      description: `${streakNum} game win streak`,
    });
  }

  // ❄️ ICE COLD - 5+ game losing streak
  if (isLossStreak && streakNum >= 5) {
    badges.push({
      id: 'ice_cold',
      icon: 'snow-outline',
      label: 'Ice Cold',
      color: '#60a5fa',
      description: `${streakNum} game losing streak`,
    });
  }

  // 🛡️ DEFENSIVE WALL - Top tier goals against
  if (goalsAgainstPerGame <= 2.5) {
    badges.push({
      id: 'defensive_wall',
      icon: 'shield',
      label: 'Defensive Wall',
      color: '#10b981',
      description: `Only ${goalsAgainstPerGame.toFixed(1)} GA/game`,
    });
  }

  // ⚡ OFFENSIVE POWERHOUSE - Top tier goals for
  if (goalsPerGame >= 3.5) {
    badges.push({
      id: 'offensive_powerhouse',
      icon: 'flash',
      label: 'Offensive Force',
      color: '#f59e0b',
      description: `${goalsPerGame.toFixed(1)} GF/game`,
    });
  }

  // 📈 TRENDING UP - 8-2 or better in last 10
  if (last10Wins >= 8) {
    badges.push({
      id: 'trending_up',
      icon: 'trending-up',
      label: 'Trending Up',
      color: '#10b981',
      description: `${last10Wins}-${last10Losses} in last 10`,
    });
  }

  // 📉 STRUGGLING - 2-8 or worse in last 10
  if (last10Wins <= 2 && (last10Wins + last10Losses) >= 8) {
    badges.push({
      id: 'struggling',
      icon: 'trending-down',
      label: 'Struggling',
      color: '#ef4444',
      description: `${last10Wins}-${last10Losses} in last 10`,
    });
  }

  // 🏆 CUP CONTENDER - High win %, positive goal diff, in playoff spot
  const standingsRank = standings?.conferenceSequence || 99;
  if (winPct >= 0.60 && goalDifferential > 20 && standingsRank <= 8) {
    badges.push({
      id: 'cup_contender',
      icon: 'trophy',
      label: 'Cup Contender',
      color: '#fbbf24',
      description: 'Elite record & playoff position',
    });
  }

  // ⭐ UNDERDOG STORY - Playoff position despite negative goal differential
  if (standingsRank <= 8 && goalDifferential < 0) {
    badges.push({
      id: 'underdog',
      icon: 'star',
      label: 'Underdog Story',
      color: '#a78bfa',
      description: 'Winning close games',
    });
  }

  // 💪 RESILIENT - Above .500 despite high GA
  if (winPct > 0.50 && goalsAgainstPerGame > 3.2) {
    badges.push({
      id: 'resilient',
      icon: 'fitness',
      label: 'Resilient',
      color: '#f97316',
      description: 'Outscoring defensive issues',
    });
  }

  // 🎯 BALANCED - Similar GF and GA, around .500
  const goalDiff = Math.abs(goalsPerGame - goalsAgainstPerGame);
  if (goalDiff < 0.3 && winPct >= 0.45 && winPct <= 0.55) {
    badges.push({
      id: 'balanced',
      icon: 'ellipse-outline',
      label: 'Balanced',
      color: '#60a5fa',
      description: 'Evenly matched games',
    });
  }

  // 🚀 HOT START - Early season success
  if (gamesPlayed < 15 && winPct >= 0.65) {
    badges.push({
      id: 'hot_start',
      icon: 'rocket',
      label: 'Hot Start',
      color: '#f59e0b',
      description: 'Strong early season',
    });
  }

  return badges;
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.factbox,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
});
