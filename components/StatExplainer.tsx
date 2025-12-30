import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ADVANCED_METRICS, AdvancedMetric } from '../constants/advancedMetrics';
import { theme } from '../constants/theme';

interface StatExplainerProps {
  visible: boolean;
  onClose: () => void;
  metricId: string | null;
  leagueThresholds?: { elite: number; good: number; average: number };
}

export default function StatExplainer({ visible, onClose, metricId, leagueThresholds }: StatExplainerProps) {
  if (!metricId) {
    return null;
  }

  const metric: AdvancedMetric | undefined = ADVANCED_METRICS[metricId];

  if (!metric) {
    return null;
  }

  // Use league thresholds if available, otherwise fall back to metric thresholds
  const thresholds = leagueThresholds || metric.thresholds;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayBackground}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={styles.title}>{metric.name}</Text>
              <Text style={styles.shortDesc}>{metric.shortDesc}</Text>
            </View>

            {/* What It Is */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What is it?</Text>
              <Text style={styles.sectionText}>{metric.whatItIs}</Text>
            </View>

            {/* Why It Matters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why does it matter?</Text>
              <Text style={styles.sectionText}>{metric.whyItMatters}</Text>
            </View>

            {/* How to Read */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to interpret it</Text>
              <Text style={styles.sectionText}>{metric.howToRead}</Text>
            </View>

            {/* Rating Scale */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rating Scale</Text>
              <View style={styles.ratingScale}>
                <View style={styles.ratingRow}>
                  <View style={[styles.ratingBadge, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.ratingBadgeText}>Elite</Text>
                  </View>
                  <Text style={styles.ratingValue}>
                    {metric.higherIsBetter
                      ? `≥ ${thresholds.elite.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`
                      : `≤ ${thresholds.elite.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`}
                  </Text>
                </View>

                <View style={styles.ratingRow}>
                  <View style={[styles.ratingBadge, { backgroundColor: '#60a5fa' }]}>
                    <Text style={styles.ratingBadgeText}>Good</Text>
                  </View>
                  <Text style={styles.ratingValue}>
                    {metric.higherIsBetter
                      ? `${thresholds.good.toFixed(1)}-${thresholds.elite.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`
                      : `${thresholds.elite.toFixed(1)}-${thresholds.good.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`}
                  </Text>
                </View>

                <View style={styles.ratingRow}>
                  <View style={[styles.ratingBadge, { backgroundColor: '#f59e0b' }]}>
                    <Text style={styles.ratingBadgeText}>Average</Text>
                  </View>
                  <Text style={styles.ratingValue}>
                    {metric.higherIsBetter
                      ? `${thresholds.average.toFixed(1)}-${thresholds.good.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`
                      : `${thresholds.good.toFixed(1)}-${thresholds.average.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`}
                  </Text>
                </View>

                <View style={styles.ratingRow}>
                  <View style={[styles.ratingBadge, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.ratingBadgeText}>Poor</Text>
                  </View>
                  <Text style={styles.ratingValue}>
                    {metric.higherIsBetter
                      ? `< ${thresholds.average.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`
                      : `> ${thresholds.average.toFixed(1)}${metric.format === 'percentage' ? '%' : ''}`}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: theme.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accent + '44',
    overflow: 'hidden',
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  statIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  shortDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
  },
  ratingScale: {
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 70,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  closeButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
