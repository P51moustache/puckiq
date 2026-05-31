import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import PageHeader from '../../components/PageHeader';
import { ThemedView } from '../../components/ThemedView';
import InsightFinderCard from '../../components/InsightFinderCard';
import { rinkGlass, theme } from '../../constants/theme';
import { useInsightFinder } from '../../hooks/useInsightFinder';
import type { InsightDepth } from '../../types/insights';

const DEPTH_OPTIONS: { value: InsightDepth; label: string; blurb: string }[] = [
  { value: 1, label: 'Simple', blurb: 'Clear signals — who’s hot and on a roll' },
  { value: 2, label: 'Standard', blurb: 'Adds regression watch & cooling players' },
  { value: 3, label: 'Advanced', blurb: 'Adds possession / PDO-driven nuance' },
];

export default function InsightsScreen() {
  const {
    prefs,
    hasFavorites,
    sections,
    isLoading,
    refreshing,
    error,
    setDepth,
    setFavoritesOnly,
    onRefresh,
  } = useInsightFinder();

  const handleShare = useCallback((text: string) => {
    Share.share({ message: text }).catch(() => {});
  }, []);

  const activeBlurb = DEPTH_OPTIONS.find((d) => d.value === prefs.depth)?.blurb ?? '';

  return (
    <ThemedView style={[styles.container, { backgroundColor: rinkGlass.ice }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <PageHeader title="Insights" subtitle="Auto-surfaced patterns worth knowing" />

        {/* Depth control */}
        <View style={styles.controls}>
          <View style={styles.segment}>
            {DEPTH_OPTIONS.map((opt) => {
              const active = prefs.depth === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setDepth(opt.value)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.blurb}>{activeBlurb}</Text>

          {hasFavorites ? (
            <View style={styles.favRow}>
              <Text style={styles.favLabel}>Favourite teams only</Text>
              <Switch
                value={prefs.favoritesOnly}
                onValueChange={setFavoritesOnly}
                trackColor={{ true: theme.accent, false: rinkGlass.glassBorder }}
                thumbColor="#fff"
              />
            </View>
          ) : null}
        </View>

        {/* Body */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.muted}>Scanning the league…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No insights to surface yet</Text>
            <Text style={styles.muted}>
              {prefs.favoritesOnly
                ? 'Try turning off the favourite-teams filter, or check back after the next games.'
                : 'Check back once more games have been played this season.'}
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.insights.length}</Text>
              </View>
              {section.insights.map((insight, idx) => (
                <InsightFinderCard
                  key={insight.id}
                  insight={insight}
                  index={idx}
                  onShare={handleShare}
                />
              ))}
            </View>
          ))
        )}

        <Text style={styles.footnote}>
          Insights are generated from on-ice performance trends. For analysis and entertainment only.
        </Text>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  controls: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: theme.accent,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.subtext,
  },
  segmentLabelActive: {
    color: rinkGlass.ice,
  },
  blurb: {
    marginTop: 8,
    fontSize: 12,
    color: theme.subtext,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  favLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  section: {
    marginTop: 18,
    marginHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.subtext,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
  },
  muted: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
  },
  footnote: {
    marginTop: 24,
    marginHorizontal: 24,
    fontSize: 11,
    color: rinkGlass.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
