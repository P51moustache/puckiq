import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { useTonightRoster } from '../hooks/useTonightRoster';
import PageHeader from './PageHeader';
import RosterBuilder from './RosterBuilder';
import TonightPlayerRow from './TonightPlayerRow';

function formatSlateDate(date: string | null): string {
  if (!date) {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function TonightRosterScreen() {
  const router = useRouter();
  const { isLoading, hasRoster, roster, date, nextDate, statuses, error, onRefresh } = useTonightRoster();
  const [showBuilder, setShowBuilder] = useState(false);

  const playing = useMemo(
    () => statuses.filter((row) => !!row.opponentAbbrev),
    [statuses],
  );
  const offNight = useMemo(
    () => statuses.filter((row) => !row.opponentAbbrev),
    [statuses],
  );

  const handleSaved = useCallback(() => {
    setShowBuilder(false);
    onRefresh();
  }, [onRefresh]);

  if (isLoading) {
    return (
      <View style={styles.centered} testID="tonight-loading">
        <ActivityIndicator size="large" color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="tonight-roster-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={rinkGlass.blueLight}
          />
        }
      >
        <PageHeader
          title="Tonight"
          subtitle={`${formatSlateDate(date)} · My roster`}
        />

        {!hasRoster ? (
          <View style={styles.empty} testID="tonight-empty">
            <Ionicons name="trophy-outline" size={48} color={rinkGlass.blueLight} />
            <Text style={styles.emptyTitle}>Add your fantasy team</Text>
            <Text style={styles.emptyCopy}>
              Search NHL players, save ~12 names, and Tonight only shows those players — opponent, scratch/injury, start/sit.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => setShowBuilder(true)}
              testID="tonight-add-roster"
            >
              <Text style={styles.ctaText}>Add players</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View testID="tonight-roster">
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {playing.length} play tonight · {offNight.length} off
              </Text>
              {statuses.length > 0 && playing.length === 0 && nextDate ? (
                <Text style={styles.nextSlate}>Next NHL slate {nextDate}</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            {playing.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PLAYING TONIGHT</Text>
                {playing.map((row) => (
                  <TonightPlayerRow key={row.playerId} status={row} />
                ))}
              </View>
            )}

            {offNight.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>OFF TONIGHT</Text>
                {offNight.map((row) => (
                  <TonightPlayerRow key={row.playerId} status={row} />
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.secondary}
              onPress={() => router.push('/myteam')}
              testID="tonight-edit-roster"
            >
              <Ionicons name="pencil" size={16} color={rinkGlass.blueLight} />
              <Text style={styles.secondaryText}>Edit roster</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <RosterBuilder
        visible={showBuilder}
        onDismiss={() => setShowBuilder(false)}
        onSaved={handleSaved}
        existingRoster={roster}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  centered: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  empty: {
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: rinkGlass.textSecondary,
    textAlign: 'center',
  },
  cta: {
    marginTop: 24,
    backgroundColor: rinkGlass.blueLight,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaText: {
    color: '#0a0e1a',
    fontWeight: '800',
    fontSize: 16,
  },
  summary: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },
  nextSlate: {
    marginTop: 4,
    fontSize: 12,
    color: rinkGlass.textMuted,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: rinkGlass.redLine,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: rinkGlass.textSecondary,
    marginBottom: 10,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryText: {
    color: rinkGlass.blueLight,
    fontWeight: '600',
    fontSize: 15,
  },
});
