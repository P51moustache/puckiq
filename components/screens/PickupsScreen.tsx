/**
 * Pickups — streamers ranked by what they add to MY lineup: nights they'd actually
 * start for me (empty slots first), not league-wide points.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useNhlToday, usePickups, useWeekHasGamesLeft } from '../../hooks/useCoach';
import { filterPickups, type PickupFilter, type PickupRow } from '../../services/fantasy/pickups';
import { formatValue } from '../../services/fantasy/scoring';
import { positionLabel } from '../../services/fantasy/positions';
import { addPlayers, unhideAllPickups } from '../../services/teams';
import { addDays, mondayOf, previousSeasonId, seasonIdFor, seasonLabel } from '../../services/nhl/dates';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { Card, ColdBadge, colors, display, EmptyState, ErrorState, HotBadge, LoadingRows, Pill, PrimaryButton, SegmentedControl } from '../coach/ui';
import * as Haptics from 'expo-haptics';
import { ART } from '../../constants/art';
import { track } from '../../services/analytics/track';

type When = 'week' | 'next' | 'today' | 'tomorrow';

const FILTERS: Array<{ value: PickupFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'F', label: 'F' },
  { value: 'D', label: 'D' },
  { value: 'G', label: 'G' },
];

const FREE_VISIBLE = 1;

function slotToFilter(slot: string | undefined): PickupFilter {
  if (slot === 'D') return 'D';
  if (slot === 'G') return 'G';
  if (slot === 'C' || slot === 'LW' || slot === 'RW' || slot === 'F') return 'F';
  return 'ALL';
}

function PickupCard({ row, onPress, onAdd }: { row: PickupRow; onPress: () => void; onAdd: () => void }) {
  const rate = row.form.recentRate ?? row.form.seasonRate;
  return (
    <Card onPress={onPress} style={styles.card} testID={`pickup-${row.playerId}`}>
      <View style={styles.row}>
        <PlayerAvatar playerId={row.playerId} team={row.team} position={row.position} size={58} />
        <View style={styles.text}>
          <PlayerName name={row.name} size={17} />
          <Text style={styles.meta}>
            {positionLabel({ position: row.position })} · {row.team} · {formatValue(rate)}/{row.form.isGoalie ? 'start' : 'gm'}
            {row.form.recentRate !== null ? ' L14' : ''}
          </Text>
        </View>
        <View style={styles.gain}>
          <Text style={styles.gainValue}>+{formatValue(row.gain)}</Text>
          <Text style={styles.gainLabel}>VALUE ADDED</Text>
        </View>
      </View>
      <View style={styles.days}>
        {row.days.map((day) => (
          <View
            key={day.date}
            style={[
              styles.day,
              day.usable && styles.dayUsable,
              day.fillsEmpty && styles.dayFills,
            ]}
          >
            <Text style={[styles.dayAbbrev, day.usable && styles.dayOnDark]}>{day.dayAbbrev.slice(0, 2)}{day.offNight ? ' ·' : ''}</Text>
            <Text style={[styles.dayOpp, day.usable && styles.dayOnDark]}>{day.isHome ? '' : '@'}{day.opponent}</Text>
          </View>
        ))}
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Add ${row.name} to my team`}
          hitSlop={6}
          testID={`pickup-add-${row.playerId}`}
        >
          <Ionicons name="add" size={22} color={colors.onInk} />
        </Pressable>
      </View>
      <View style={styles.tags}>
        {row.emptyFills > 0 ? <Pill label={`FILLS ${row.emptyFills} EMPTY`} tone="good" /> : null}
        {row.usableGames > row.emptyFills ? <Pill label={`UPGRADES ${row.usableGames - row.emptyFills}`} tone="ink" /> : null}
        {row.offNightGames > 0 ? <Pill label={`${row.offNightGames} OFF-NIGHT`} tone="neutral" /> : null}
        {row.form.trend === 'hot' ? <HotBadge /> : row.form.trend === 'cold' ? (
          <ColdBadge />
        ) : null}
        {row.form.isGoalie ? <Pill label={`${Math.round(row.form.startShare * 100)}% GS`} tone="muted" /> : null}
      </View>
    </Card>
  );
}

export default function PickupsScreen() {
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const { team, ready, updateTeam } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const today = useNhlToday();
  const tomorrow = addDays(today, 1);
  const tomorrowInWeek = mondayOf(tomorrow) === mondayOf(today);
  const [filter, setFilter] = useState<PickupFilter>(slotToFilter(params.slot));
  const [when, setWhen] = useState<When>(params.date === today ? 'today' : params.date === tomorrow && tomorrowInWeek ? 'tomorrow' : 'week');

  useEffect(() => {
    if (params.slot) setFilter(slotToFilter(params.slot));
    if (params.date === today) setWhen('today');
    else if (params.date === tomorrow && tomorrowInWeek) setWhen('tomorrow');
  }, [params.slot, params.date, today, tomorrow, tomorrowInWeek]);

  const [hideOwned, setHideOwned] = useState(true);
  const gamesLeftThisWeek = useWeekHasGamesLeft(today);

  // Preseason, the All-Star break, or a Sunday night: plan next week instead of an empty one.
  useEffect(() => {
    if (gamesLeftThisWeek === false && when === 'week') setWhen('next');
  }, [gamesLeftThisWeek, when]);

  const onlyDate = when === 'today' ? today : when === 'tomorrow' ? tomorrow : undefined;
  const view = usePickups(team, true, onlyDate, hideOwned, when === 'next' ? 1 : 0);
  const rows = useMemo(() => filterPickups(view.rows, filter).filter((row) => row.gain > 0 || row.usableGames > 0), [view.rows, filter]);
  const visible = isPremium ? rows : rows.slice(0, FREE_VISIBLE);
  const hiddenCount = team?.hiddenPickupIds.length ?? 0;
  const basisLabel = seasonLabel(previousSeasonId(seasonIdFor(today)));

  if (!ready) {
    return (
      <View style={styles.container}>
        <PageHeader title="Pickups" />
        <View style={styles.padded}><LoadingRows count={6} /></View>
      </View>
    );
  }

  if (!team || team.players.length === 0) {
    return (
      <View style={styles.container}>
        <PageHeader title="Pickups" accessory={<TeamSwitcher />} />
        <EmptyState art={ART.emptyRoster} title="Pickups need your roster" body="Add your players first — pickups are ranked by the holes in YOUR lineup." />
      </View>
    );
  }

  const whenOptions: Array<{ value: When; label: string }> = gamesLeftThisWeek === false
    ? [{ value: 'next', label: 'Next week' }]
    : [
        { value: 'week', label: 'This week' },
        { value: 'next', label: 'Next week' },
        { value: 'today', label: 'Today' },
        ...(tomorrowInWeek ? [{ value: 'tomorrow' as When, label: 'Tmrw' }] : []),
      ];

  return (
    <View style={styles.container} testID="pickups-screen">
      <PageHeader title="Pickups" accessory={<TeamSwitcher />} />
      <FlatList
        data={visible}
        keyExtractor={(row) => String(row.playerId)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={view.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={(
          <View>
            <Text style={styles.lede}>
              Ranked by what they add to YOUR lineup — only nights they’d actually start for you.
            </Text>
            <SegmentedControl<When> value={when} onChange={setWhen} options={whenOptions} testID="pickups-when" />
            {gamesLeftThisWeek === false ? (
              <Text style={styles.basis}>No NHL games left this week — ranking for next week.</Text>
            ) : null}
            <View style={styles.filters}>
              {FILTERS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  style={[styles.filter, filter === option.value && styles.filterOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === option.value }}
                  testID={`pickups-filter-${option.value}`}
                >
                  <Text style={[styles.filterText, filter === option.value && styles.filterTextOn]}>{option.label}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setHideOwned((value) => !value)}
                style={[styles.filter, styles.ownedToggle]}
                accessibilityRole="switch"
                accessibilityState={{ checked: hideOwned }}
                accessibilityLabel="Hide players likely already rostered"
                testID="pickups-owned-toggle"
              >
                <Ionicons name={hideOwned ? 'eye-off-outline' : 'eye-outline'} size={13} color={colors.sub} />
                <Text style={styles.filterText}>{hideOwned ? 'Available' : 'Everyone'}</Text>
              </Pressable>
            </View>
            {hideOwned ? (
              <Text style={styles.ownedNote}>
                Hiding players a {team.leagueSize}-team league almost always rosters. Change league size in League settings.
              </Text>
            ) : null}
            {!view.hasCurrentSeason && !view.loading ? (
              <Text style={styles.basis}>Using {basisLabel} numbers until this season has games.</Text>
            ) : null}
            {view.error && rows.length === 0 ? <ErrorState body={view.error} onRetry={view.refresh} /> : null}
            {view.loading && rows.length === 0 ? <LoadingRows count={6} /> : null}
          </View>
        )}
        ListEmptyComponent={
          view.loading || view.error ? null : (
            <EmptyState
              art={ART.lineupFull}
              title="No useful pickups"
              body={when === 'week' || when === 'next'
                ? `Nobody available would start for you on the nights left ${when === 'next' ? 'next week' : 'this week'}. Your lineup is full where it counts.`
                : 'Nobody available plays and would start for you on this night.'}
            />
          )
        }
        renderItem={({ item, index }) => (
          <PickupCard
            row={item}
            onPress={() => openPlayer(item.playerId, 'pickup')}
            onAdd={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              track('pickup_add', { when, rank: index + 1 });
              updateTeam((current) => addPlayers(current, [{
                playerId: item.playerId,
                playerName: item.name,
                teamAbbrev: item.team,
                position: item.position,
                rosterPosition: 'BN',
              }]));
            }}
          />
        )}
        ListFooterComponent={(
          <View>
            {!isPremium && rows.length > FREE_VISIBLE ? (
              <Card style={styles.lockCard} testID="pickups-locked">
                <Ionicons name="lock-closed" size={18} color={colors.accent} />
                <Text style={styles.lockTitle}>{rows.length - FREE_VISIBLE} more pickups ranked for your lineup</Text>
                <Text style={styles.lockBody}>See every streamer that fills your empty slots, by position and night.</Text>
                <PrimaryButton label="Unlock Pickups" onPress={() => openPaywall('pickups')} style={styles.lockButton} testID="pickups-unlock" />
              </Card>
            ) : null}
            {hiddenCount > 0 ? (
              <Pressable onPress={() => updateTeam((current) => unhideAllPickups(current))} style={styles.reset} testID="pickups-reset-hidden">
                <Text style={styles.resetText}>{hiddenCount} marked taken · Show again</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
    marginBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  filter: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  filterOn: {
    backgroundColor: colors.ink,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  filterTextOn: {
    color: colors.onInk,
  },
  ownedToggle: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  ownedNote: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
  },
  basis: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warn,
    marginBottom: 10,
  },
  card: {
    marginBottom: 12,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sub,
  },
  gain: {
    alignItems: 'flex-end',
  },
  gainValue: {
    ...display(26),
    color: colors.good,
  },
  gainLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  days: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  day: {
    minWidth: 46,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayUsable: {
    backgroundColor: colors.ink,
  },
  dayFills: {
    borderColor: colors.good,
  },
  dayAbbrev: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
  },
  dayOpp: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
  },
  dayOnDark: {
    color: colors.onInk,
  },
  addButton: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: {
    opacity: 0.8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  lockCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  lockTitle: {
    ...display(20),
    textAlign: 'center',
  },
  lockBody: {
    fontSize: 14,
    color: colors.sub,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  reset: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
});
