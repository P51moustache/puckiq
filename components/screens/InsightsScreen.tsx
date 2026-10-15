import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useNight, usePickups } from '../../hooks/useCoach';
import { visibleMoves } from '../../services/fantasy/coach';
import { track } from '../../services/analytics/track';
import { rosterContext } from '../../services/analytics/rosterContext';
import { useBehaviorSnapshot } from '../../hooks/useBehaviorSnapshot';
import type { CoachMove } from '../../services/fantasy/coach';
import { formatValue } from '../../services/fantasy/scoring';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { useRoomTakenIds } from '../league/LeagueProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { SectionTabs } from '../coach/SectionTabs';
import { HockeyHero } from '../coach/HockeyHero';
import {
  Card,
  colors,
  contentFrame,
  ErrorBanner,
  GhostButton,
  LoadingRows,
  ProLockCard,
  SectionLabel,
} from '../coach/ui';
import { InsightCard } from '../insights/InsightCard';
import { InsightDetailSheet } from '../insights/InsightDetailSheet';
import {
  detailForMove,
  detailForWaiver,
  type InsightDetail,
} from '../insights/insightDetails';
import {
  TrendingPlayers,
  type TrendingPlayer,
} from '../insights/TrendingPlayers';
import { InsightsTrades } from '../insights/InsightsTrades';
import { PlayerAvatar } from '../coach/PlayerAvatar';

export default function InsightsScreen() {
  const { team } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const router = useRouter();
  const focused = useIsFocused();
  const [tab, setTab] = useState<'you' | 'news' | 'waiver' | 'trades'>('you');
  const [selectedInsight, setSelectedInsight] = useState<InsightDetail | null>(
    null,
  );
  const taken = useRoomTakenIds();
  const view = useNight(team, 0, focused);
  const pickups = usePickups(
    team,
    focused && (tab === 'you' || tab === 'waiver') && isPremium,
    undefined,
    true,
    0,
    taken,
  );
  const moves = visibleMoves(view.moves, isPremium);
  const waiverInsight =
    isPremium && pickups.rows[0] ? detailForWaiver(pickups.rows[0]) : null;
  const featured =
    moves.find((move) => move.kind !== 'off' && move.kind !== 'clean') ??
    moves[0];
  useBehaviorSnapshot('insights', {
    ...rosterContext(team), tab,
    state: !team?.players.length ? 'empty_roster' : view.error ? 'error' : view.loading ? 'loading' : 'ready',
    available_moves: tab === 'you' ? moves.length : 0,
    hidden_moves: view.moves.length - moves.length,
  });
  const openMove = (move: CoachMove) => {
    track('advice_open', { surface: 'insights', move_kind: move.kind, affected_players: move.playerIds.length });
    setSelectedInsight(detailForMove(move, team?.players ?? []));
  };
  const trending: TrendingPlayer[] = [
    ...(team?.players ?? []).flatMap((p) => {
      const form = view.forms.data?.forms.get(p.playerId);
      return form
        ? [
            {
              id: p.playerId,
              name: p.playerName,
              team: p.teamAbbrev,
              position: p.position,
              form,
              owned: true,
            },
          ]
        : [];
    }),
    ...pickups.rows.slice(0, 20).map((p) => ({
      id: p.playerId,
      name: p.name,
      team: p.team,
      position: p.position,
      form: p.form,
      owned: false,
    })),
  ];
  return (
    <View style={styles.container} testID="insights-screen">
      <PageHeader
        compact
        title="Insights"
        accessory={<TeamSwitcher compact />}
      />
      <ScrollView
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={
          <RefreshControl
            refreshing={view.refreshing || pickups.refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              view.refresh();
              if (tab === 'you' || tab === 'waiver') pickups.refresh();
            }}
          />
        }
      >
        <SectionTabs
          comfortable
          value={tab}
          onChange={setTab}
          options={[
            { value: 'you', label: 'For you' },
            { value: 'news', label: 'News' },
            { value: 'waiver', label: 'Waiver wire' },
            { value: 'trades', label: 'Trades' },
          ]}
          testID="insights-tab"
        />
        {view.error ? (
          <ErrorBanner
            message="Some insights are unavailable. Pull to refresh."
            onRetry={view.refresh}
          />
        ) : null}
        {!team?.players.length ? (
          <Card style={styles.space}>
            <Text style={styles.copy}>
              Build your roster to get player insights and lineup
              recommendations for your league.
            </Text>
            <GhostButton
              label="Add players"
              onPress={() => router.push('/myteam' as Href)}
            />
          </Card>
        ) : tab === 'you' ? (
          <>
            <View style={styles.space}>
              {view.loading && !view.night.data ? (
                <LoadingRows count={2} />
              ) : featured ? (
                <InsightCard
                  featured
                  testID="insight-featured"
                  title={featured.title}
                  detail={featured.detail}
                  onPress={() =>
                    openMove(featured)
                  }
                />
              ) : (
                <InsightCard
                  featured
                  title="Get ahead of the next puck drop"
                  detail="Compare your best lineup, review upcoming player matchups, and plan pickups around the positions you can actually use."
                  onPress={() => router.push('/lineup' as Href)}
                />
              )}
            </View>
            {isPremium ? (
              <TrendingPlayers
                players={trending}
                onOpen={(row) =>
                  openPlayer(
                    row.id,
                    row.owned ? 'roster' : 'pickup',
                    row.owned ? 'tonight' : 'pickups',
                  )
                }
              />
            ) : (
              <ProLockCard
                title="Player trends"
                detail="See whose recent fantasy value is rising against their season baseline."
                onPress={() => openPaywall('player_trends')}
              />
            )}
            <SectionLabel
              title="Moves that matter"
              right={
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => router.push('/lineup' as Href)}
                >
                  <Text style={styles.more}>Review lineup →</Text>
                </Pressable>
              }
            />
            <View style={styles.tiles}>
              {moves
                .filter((move) => move.id !== featured?.id)
                .slice(0, waiverInsight ? 2 : 3)
                .map((move) => (
                  <InsightCard
                    compact
                    testID={`insight-move-${move.id}`}
                    key={move.id}
                    title={move.title}
                    detail={move.detail}
                    onPress={() =>
                      openMove(move)
                    }
                    icon={
                      move.kind === 'goalie'
                        ? 'shield-checkmark-outline'
                        : 'trending-up-outline'
                    }
                  />
                ))}
              {waiverInsight ? (
                <InsightCard
                  compact
                  testID="insight-waiver"
                  title={waiverInsight.title}
                  detail={waiverInsight.detail}
                  icon="locate-outline"
                  onPress={() => setSelectedInsight(waiverInsight)}
                />
              ) : null}
            </View>
            {!isPremium ? (
              <ProLockCard
                title="Unlock your full set of insights"
                detail="Every coach move, personal waiver targets, player trends and trade comparisons."
                onPress={() => openPaywall('tonight_moves')}
              />
            ) : null}
          </>
        ) : tab === 'news' ? (
          <>
            <SectionLabel title="Your players in the news" />
            {!view.night.data && view.loading ? (
              <LoadingRows count={3} />
            ) : view.night.data?.news.length ? (
              <View style={styles.stack}>
                {view.night.data.news.map((item) => (
                  <Card
                    key={item.id}
                    onPress={() =>
                      Linking.openURL(item.url).catch(() => undefined)
                    }
                  >
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    {item.summary ? (
                      <Text style={styles.copy} numberOfLines={3}>
                        {item.summary}
                      </Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {item.source || 'ESPN'} ·{' '}
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString()
                        : ''}{' '}
                      ↗
                    </Text>
                  </Card>
                ))}
              </View>
            ) : (
              <Card>
                <Text style={styles.copy}>
                  No recent headlines mention your roster. Pull to refresh for
                  new reports.
                </Text>
              </Card>
            )}
          </>
        ) : tab === 'waiver' ? (
          <>
            <SectionLabel title="Targets for your lineup" />
            {!isPremium ? (
              <ProLockCard
                title="Pickups for your real gaps"
                detail="Ranked by usable games and the positions they fill for you."
                onPress={() => openPaywall('pickups')}
              />
            ) : pickups.loading && !pickups.rows.length ? (
              <LoadingRows count={5} />
            ) : pickups.error ? (
              <ErrorBanner
                message="Waiver targets didn’t load."
                onRetry={pickups.refresh}
              />
            ) : pickups.rows.length ? (
              <Card style={styles.waivers}>
                {pickups.rows.slice(0, 8).map((p) => (
                  <Card
                    key={p.playerId}
                    onPress={() => openPlayer(p.playerId, 'pickup', 'pickups')}
                    style={styles.waiverRow}
                  >
                    <PlayerAvatar
                      playerId={p.playerId}
                      team={p.team}
                      position={p.position}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.newsTitle}>{p.name}</Text>
                      <Text style={styles.meta}>
                        {p.team} · {p.position} · {p.usableGames} usable games
                      </Text>
                    </View>
                    <Text style={styles.gain}>
                      +{formatValue(Math.max(0, p.gain))}
                    </Text>
                  </Card>
                ))}
              </Card>
            ) : (
              <Card>
                <Text style={styles.copy}>
                  No pickup fits your remaining schedule. Use the full pickup
                  finder to look ahead or adjust availability filters.
                </Text>
              </Card>
            )}
            <Text style={styles.meta}>
              Availability is estimated from league size and positions; it is
              not your host’s waiver list.
            </Text>
            <GhostButton
              label="Open full pickup finder"
              onPress={() => router.push('/pickups' as Href)}
              style={styles.space}
            />
          </>
        ) : (
          <InsightsTrades />
        )}
        <HockeyHero title={'Better decisions.\nBigger wins.'} compact />
      </ScrollView>
      <InsightDetailSheet
        detail={selectedInsight}
        onClose={() => setSelectedInsight(null)}
        onOpenPlayer={(player) =>
          openPlayer(
            player.id,
            player.owned ? 'roster' : 'pickup',
            player.owned ? 'tonight' : 'pickups',
          )
        }
        onAction={(action) => {
          track('advice_action', { surface: 'insights', action, gated: false, affected_players: selectedInsight?.players.length ?? 0 });
          router.push((action === 'pickups' ? '/pickups' : '/lineup') as Href);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 12, paddingBottom: 100 },
  space: { marginTop: 8 },
  copy: { fontSize: 13, lineHeight: 18, color: colors.sub, marginVertical: 5 },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    color: colors.text,
  },
  meta: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 4 },
  stack: { gap: 6 },
  tiles: { gap: 6 },
  more: { fontSize: 13, color: colors.accent },
  waivers: { padding: 0 },
  waiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 0,
    borderRadius: 0,
    padding: 8,
  },
  gain: { fontSize: 15, color: colors.good, fontWeight: '600' },
});
