import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface TonightPreviewProps {
  hasRoster: boolean;
  onStartTrial: () => void;
  onContinueFree: () => void;
}

const PRO_FEATURES: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }[] = [
  { icon: 'analytics', color: '#60a5fa', text: 'ML-powered start/sit recommendations' },
  { icon: 'notifications', color: '#fbbf24', text: 'Waiver wire pickup alerts' },
  { icon: 'shield-checkmark', color: '#10b981', text: 'Matchup strength analysis' },
  { icon: 'swap-horizontal', color: '#a78bfa', text: 'Trade value calculator' },
  { icon: 'medkit', color: '#ef4444', text: 'Injury impact projections' },
];

export function TonightPreview({ hasRoster, onStartTrial, onContinueFree }: TonightPreviewProps) {
  return (
    <LinearGradient
      colors={['#0f172a', '#1e3a8a', '#071023']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View style={styles.content}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.title}>
          Here's what PuckIQ{'\n'}sees tonight
        </Animated.Text>

        {/* Hero prediction card */}
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.predictionCard}>
          <View style={styles.predictionHeader}>
            <View style={styles.teamBlock}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamLogoText}>COL</Text>
              </View>
              <Text style={styles.teamName}>Avalanche</Text>
            </View>

            <View style={styles.vsBlock}>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.confidenceBadge}>
                <Ionicons name="diamond" size={10} color="#60a5fa" />
                <Text style={styles.confidenceText}>72%</Text>
              </View>
            </View>

            <View style={styles.teamBlock}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamLogoText}>EDM</Text>
              </View>
              <Text style={styles.teamName}>Oilers</Text>
            </View>
          </View>

          {/* Win probability bar */}
          <View style={styles.probContainer}>
            <Text style={styles.probPercent}>62%</Text>
            <View style={styles.probBarTrack}>
              <LinearGradient
                colors={['#60a5fa', '#3b82f6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.probBarFill, { width: '62%' }]}
              />
            </View>
            <Text style={styles.probPercentRight}>38%</Text>
          </View>

          <Text style={styles.predictionDetail}>
            Strong road record, MacKinnon on a 5-game point streak
          </Text>
        </Animated.View>

        {hasRoster && (
          <Animated.View entering={FadeIn.duration(400).delay(500)} style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name="flash" size={16} color="#fbbf24" />
            </View>
            <Text style={styles.insightText}>
              McDavid is a must-start tonight — soft matchup vs SEA
            </Text>
          </Animated.View>
        )}

        {/* Pro features */}
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.proSection}>
          <Text style={styles.proTitle}>PuckIQ Pro includes:</Text>
          {PRO_FEATURES.map((feature, i) => (
            <Animated.View
              key={feature.text}
              entering={FadeInDown.duration(400).delay(600 + i * 80)}
              style={styles.proRow}
            >
              <View style={[styles.proIconCircle, { backgroundColor: `${feature.color}18` }]}>
                <Ionicons name={feature.icon} size={16} color={feature.color} />
              </View>
              <Text style={styles.proFeature}>{feature.text}</Text>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.duration(500).delay(1000)} style={styles.buttons}>
        <TouchableOpacity onPress={onStartTrial} activeOpacity={0.85}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb', '#1d4ed8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trialButton}
          >
            <Text style={styles.trialText}>Start Free Trial</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.trialSubtext}>7 days free, then $6.99/mo</Text>

        <TouchableOpacity onPress={onContinueFree} style={styles.freeLink} activeOpacity={0.6}>
          <Text style={styles.freeText}>Continue Free</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 36,
    marginBottom: 20,
    letterSpacing: -0.5,
  },

  // Prediction card
  predictionCard: {
    backgroundColor: '#192e5e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a4080',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamBlock: {
    alignItems: 'center',
    flex: 1,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  teamLogoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 12,
    color: '#98a6bf',
    fontWeight: '500',
  },
  vsBlock: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a6a85',
    letterSpacing: 2,
    marginBottom: 6,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  confidenceText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },

  // Probability bar
  probContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  probPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: '#60a5fa',
    width: 44,
  },
  probBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  probBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  probPercentRight: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5a6a85',
    width: 44,
    textAlign: 'right',
  },
  predictionDetail: {
    fontSize: 13,
    color: '#98a6bf',
    lineHeight: 19,
  },

  // Insight card
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  insightIcon: {
    marginRight: 10,
  },
  insightText: {
    color: '#e6eef8',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },

  // Pro features
  proSection: {
    marginTop: 8,
  },
  proTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e6eef8',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  proIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  proFeature: {
    color: '#98a6bf',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // CTA
  buttons: {
    gap: 4,
  },
  trialButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  trialText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trialSubtext: {
    color: '#98a6bf',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  freeLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  freeText: {
    color: '#98a6bf',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
