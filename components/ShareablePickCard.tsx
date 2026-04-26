import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';

export interface ShareablePickCardProps {
  awayAbbrev: string;
  homeAbbrev: string;
  awayName: string;
  homeName: string;
  awayWinProb: number;
  homeWinProb: number;
  confidenceScore: number;
  fantasyContext?: string;
}

function getConfidenceLabel(score: number): string {
  if (score >= 75) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
}

export default function ShareablePickCard({
  awayAbbrev,
  homeAbbrev,
  awayName,
  homeName,
  awayWinProb,
  homeWinProb,
  confidenceScore,
  fantasyContext,
}: ShareablePickCardProps) {
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);
  const favoredIsHome = homeWinProb >= awayWinProb;
  const pickName = favoredIsHome ? homeName : awayName;
  const awayPct = Math.round(awayWinProb);
  const homePct = Math.round(homeWinProb);
  const confidenceLabel = getConfidenceLabel(confidenceScore);

  return (
    <View style={styles.card} testID="shareable-pick-card">
      {/* Header branding */}
      <View style={styles.header}>
        <Text style={styles.brandEmoji}>🏒</Text>
        <Text style={styles.brandText}>PUCKIQ</Text>
      </View>

      {/* Matchup row */}
      <View style={styles.matchupRow}>
        <View style={styles.teamSide}>
          <Image
            source={{ uri: getTeamLogoUrl(awayAbbrev) }}
            style={styles.teamLogo}
            contentFit="contain"
          />
          <Text style={styles.teamAbbrev}>{awayAbbrev}</Text>
        </View>

        <Text style={styles.vsText}>vs</Text>

        <View style={styles.teamSide}>
          <Image
            source={{ uri: getTeamLogoUrl(homeAbbrev) }}
            style={styles.teamLogo}
            contentFit="contain"
          />
          <Text style={styles.teamAbbrev}>{homeAbbrev}</Text>
        </View>
      </View>

      {/* Probability row */}
      <View style={styles.probRow}>
        <Text style={[styles.probText, !favoredIsHome && styles.probFavored]}>
          {awayPct}%
        </Text>
        <Text style={[styles.probText, favoredIsHome && styles.probFavored]}>
          {homePct}%
        </Text>
      </View>

      {/* Probability bar */}
      <View style={styles.probBarContainer}>
        <View
          style={[
            styles.probBarAway,
            {
              flex: awayPct,
              backgroundColor: awayColors.primary,
            },
          ]}
        />
        <View
          style={[
            styles.probBarHome,
            {
              flex: homePct,
              backgroundColor: homeColors.primary,
            },
          ]}
        />
      </View>

      {/* Pick callout */}
      <View style={styles.pickRow}>
        <Text style={styles.pickDot}>🟢</Text>
        <Text style={styles.pickText}>PICK: {pickName}</Text>
      </View>
      <Text style={styles.confidenceText}>
        Confidence: {confidenceLabel} ({Math.round(confidenceScore)}%)
      </Text>

      {/* Optional fantasy context */}
      {fantasyContext ? (
        <View style={styles.fantasyRow}>
          <Text style={styles.fantasyIcon}>FP</Text>
          <Text style={styles.fantasyText}>{fantasyContext}</Text>
        </View>
      ) : null}

      {/* Divider + footer */}
      <View style={styles.divider} />
      <Text style={styles.footer}>puckiq.app • Get PuckIQ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.background,
    borderRadius: 16,
    padding: 20,
    width: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandEmoji: {
    fontSize: 18,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
  },

  // Matchup
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  teamSide: {
    alignItems: 'center',
    gap: 4,
  },
  teamLogo: {
    width: 52,
    height: 52,
  },
  teamAbbrev: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // Probabilities
  probRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  probText: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    fontFamily: theme.fonts.mono,
  },
  probFavored: {
    color: '#22c55e',
  },

  // Probability bar
  probBarContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  probBarAway: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  probBarHome: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // Pick callout
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pickDot: {
    fontSize: 14,
  },
  pickText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22c55e',
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },

  // Fantasy context
  fantasyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  fantasyIcon: {
    fontSize: 14,
  },
  fantasyText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.accent,
  },

  // Footer
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  footer: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 0.5,
  },
});
