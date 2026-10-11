import { PickupCard } from '../pickups/PickupCard';
/**
 * Pickups — streamers ranked by what they add to MY lineup: nights they'd actually
 * start for me (empty slots first), not league-wide points.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useNhlToday, usePickups, useWeekHasGamesLeft } from '../../hooks/useCoach';
import { filterPickups, type PickupFilter } from '../../services/fantasy/pickups';
import { addPlayers, unhideAllPickups } from '../../services/teams';
import { HowItWorksButton } from '../sheets/HowItWorksSheet';
import { useRoomTakenIds } from '../league/LeagueProvider';
import { addDays, mondayOf, previousSeasonId, seasonIdFor, seasonLabel } from '../../services/nhl/dates';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { Card, colors, contentFrame, display, EmptyState, ErrorState, LoadingRows, PrimaryButton, SegmentedControl, useWide } from '../coach/ui';
import * as Haptics from 'expo-haptics';
import { ART } from '../../constants/art';
import { track } from '../../services/analytics/track';
import { trackedChoice } from '../../services/analytics/selection';
import { pickupPeriodForDate, pickupPeriodInputs, validPickupDate, type PickupPeriod } from '../../services/fantasy/pickupPeriod';

type When = PickupPeriod;

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

export default function PickupsScreen() {
  const wide = useWide();
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const { team, ready, updateTeam } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const today = useNhlToday();
  const tomorrow = addDays(today, 1);
  const tomorrowInWeek = mondayOf(tomorrow) === mondayOf(today);
  const [filter, setFilter] = useState<PickupFilter>(slotToFilter(params.slot));
  const selectedDate = validPickupDate(params.date, today);
  const [when, setWhen] = useState<When>(pickupPeriodForDate(selectedDate, today));

  useEffect(() => {
    if (params.slot) setFilter(slotToFilter(params.slot));
    if (selectedDate) setWhen(pickupPeriodForDate(selectedDate, today));
  }, [params.slot, selectedDate, today]);

  const [hideOwned, setHideOwned] = useState(true);
  const gamesLeftThisWeek = useWeekHasGamesLeft(today);

  // Preseason, the All-Star break, or a Sunday night: plan next week instead of an empty one.
  useEffect(() => {
    if (gamesLeftThisWeek === false && when === 'week') setWhen('next');
  }, [gamesLeftThisWeek, when]);

  const { onlyDate, weekOffset, selectedLabel } = pickupPeriodInputs(when, today, selectedDate);
  const roomTaken = useRoomTakenIds();
  const view = usePickups(team, true, onlyDate, hideOwned, weekOffset, roomTaken);
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

  const whenOptions: Array<{ value: When; label: string }> = gamesLeftThisWeek === false && !selectedDate
    ? [{ value: 'next', label: 'Next week' }]
    : [
        { value: 'week', label: 'This week' },
        { value: 'next', label: 'Next week' },
        { value: 'today', label: 'Today' },
        ...(tomorrowInWeek || when === 'tomorrow' ? [{ value: 'tomorrow' as When, label: 'Tmrw' }] : []),
        ...(selectedDate && selectedLabel && pickupPeriodForDate(selectedDate, today) === 'date' ? [{ value: 'date' as When, label: selectedLabel }] : []),
      ];

  return (
    <View style={styles.container} testID="pickups-screen">
      <PageHeader title="Pickups" accessory={<TeamSwitcher />} />
      <FlatList
        key={wide ? 'grid' : 'list'}
        data={visible}
        numColumns={wide ? 2 : 1}
        columnWrapperStyle={wide ? styles.gridRow : undefined}
        keyExtractor={(row) => String(row.playerId)}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={view.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={(
          <View>
            <View style={styles.ledeRow}>
              <Text style={styles.lede}>
                Ranked by what they add to YOUR lineup — only nights they’d actually start for you.
              </Text>
              <HowItWorksButton
                topic="pickups"
                extra={hideOwned ? [`Hiding players a ${team.leagueSize}-team league almost always rosters.`] : []}
              />
            </View>
            {roomTaken.size > 0 ? (
              <View style={styles.roomNote} testID="pickups-room-taken">
                <Ionicons name="trophy" size={13} color={colors.text} />
                <Text style={styles.roomNoteText}>
                  League Room: hiding {roomTaken.size} players your league-mates roster
                </Text>
              </View>
            ) : null}
            <SegmentedControl<When> value={when} onChange={trackedChoice<When>('pickups', 'period', setWhen)} options={whenOptions} testID="pickups-when" />
            {gamesLeftThisWeek === false && when === 'next' ? (
              <Text style={styles.basis}>No NHL games left this week — ranking for next week.</Text>
            ) : null}
            <View style={styles.filters}>
              {FILTERS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => trackedChoice<PickupFilter>('pickups', 'position', setFilter)(option.value)}
                  style={[styles.filter, filter === option.value && styles.filterOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === option.value }}
                  testID={`pickups-filter-${option.value}`}
                >
                  <Text style={[styles.filterText, filter === option.value && styles.filterTextOn]}>{option.label}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => { track('pickup_ownership_filter', { hide_owned: !hideOwned }); setHideOwned(!hideOwned); }}
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
            {!view.hasCurrentSeason && !view.loading ? (
              <Text style={styles.basis}>Using {basisLabel} numbers where current-season data is unavailable.</Text>
            ) : null}
            {view.error ? <ErrorState body={view.error} onRetry={view.refresh} /> : null}
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
            grid={wide}
            row={item}
            onPress={() => openPlayer(item.playerId, 'pickup', 'pickups')}
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
    paddingHorizontal: 12,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 130,
  },
  roomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.raised,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  roomNoteText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  ledeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lede: {
    flex: 1,
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
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  filterOn: {
    backgroundColor: colors.accent,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
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
  basis: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warn,
    marginBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
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
