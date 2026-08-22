import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { rinkGlass } from '../constants/theme';
import { useRosterNews } from '../hooks/useRosterNews';
import PageHeader from './PageHeader';
import type { RosterNewsItem } from '../types/fantasy';

function NewsCard({ item }: { item: RosterNewsItem }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => Linking.openURL(item.url)}
      testID="roster-news-card"
      activeOpacity={0.8}
    >
      <Text style={styles.matched}>{item.matchedPlayerNames.join(' · ')}</Text>
      <Text style={styles.title}>{item.title}</Text>
      {item.summary ? (
        <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
      ) : null}
      <Text style={styles.meta}>
        {item.source}
        {item.publishedAt ? ` · ${item.publishedAt}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export default function RosterNewsScreen() {
  const router = useRouter();
  const { isLoading, hasRoster, items, error, onRefresh } = useRosterNews();

  if (isLoading) {
    return (
      <View style={styles.centered} testID="news-loading">
        <ActivityIndicator size="large" color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="roster-news-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={rinkGlass.blueLight} />
        }
      >
        <PageHeader title="News" subtitle="My players only · Public RSS" />

        {!hasRoster ? (
          <View style={styles.empty} testID="news-empty-roster">
            <Text style={styles.emptyTitle}>No roster yet</Text>
            <Text style={styles.emptyCopy}>
              Add your fantasy players and this feed only keeps stories that mention them.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => router.push('/myteam')} testID="news-go-roster">
              <Text style={styles.ctaText}>Open roster</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty} testID="news-empty-items">
            <Text style={styles.emptyTitle}>No roster news right now</Text>
            <Text style={styles.emptyCopy}>
              {error ?? 'Nothing in the public NHL feed named your players. Pull to refresh.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
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
  list: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  matched: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: rinkGlass.blueLight,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 6,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    color: rinkGlass.textSecondary,
    marginBottom: 8,
  },
  meta: {
    fontSize: 11,
    color: rinkGlass.textMuted,
  },
  empty: {
    paddingHorizontal: 28,
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
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
    marginTop: 20,
    backgroundColor: rinkGlass.blueLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: '#0a0e1a',
    fontWeight: '800',
  },
});
