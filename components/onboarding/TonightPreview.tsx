import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

interface TonightPreviewProps {
  hasRoster: boolean;
  onStartTrial: () => void;
  onContinueFree: () => void;
}

const PRO_FEATURES = [
  'ML-powered start/sit recommendations',
  'Waiver wire pickup alerts',
  'Matchup strength analysis',
  'Trade value calculator',
  'Injury impact projections',
];

export function TonightPreview({ hasRoster, onStartTrial, onContinueFree }: TonightPreviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Here's what PuckIQ sees tonight</Text>

        <View style={styles.predictionCard}>
          <View style={styles.predictionHeader}>
            <Text style={styles.teamVs}>COL vs EDM</Text>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>72% confidence</Text>
            </View>
          </View>
          <Text style={styles.predictionPick}>COL predicted to win</Text>
          <Text style={styles.predictionDetail}>
            Strong road record, MacKinnon on a 5-game point streak
          </Text>
        </View>

        {hasRoster && (
          <View style={styles.insightCard}>
            <Text style={styles.insightText}>
              McDavid is a must-start tonight — soft matchup vs SEA
            </Text>
          </View>
        )}

        <View style={styles.proSection}>
          <Text style={styles.proTitle}>PuckIQ Pro includes:</Text>
          {PRO_FEATURES.map((feature) => (
            <View key={feature} style={styles.proRow}>
              <Text style={styles.proBullet}>*</Text>
              <Text style={styles.proFeature}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.trialButton} onPress={onStartTrial}>
          <Text style={styles.trialText}>Start Free Trial</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onContinueFree} style={styles.freeLink}>
          <Text style={styles.freeText}>Continue Free</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 36,
    marginBottom: 24,
  },
  predictionCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.factbox,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamVs: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  confidenceBadge: {
    backgroundColor: theme.factbox,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  predictionPick: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 4,
  },
  predictionDetail: {
    fontSize: 14,
    color: theme.subtext,
    lineHeight: 20,
  },
  insightCard: {
    backgroundColor: theme.factbox,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  insightText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  proSection: {
    marginTop: 8,
  },
  proTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  proBullet: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
    marginTop: 1,
  },
  proFeature: {
    color: theme.subtext,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  buttons: {
    gap: 12,
  },
  trialButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  trialText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  freeLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  freeText: {
    color: theme.subtext,
    fontSize: 15,
  },
});
