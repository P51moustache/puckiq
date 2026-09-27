/**
 * Roster — the players on my fantasy team (real NHL players), grouped by position,
 * with this week's games and value. Links names typed into PuckIQ 2.x.
 */

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer } from '../../types/fantasy';
import { useNhlToday, useWeekData, useWeekHasGamesLeft } from '../../hooks/useCoach';
import { findExactNhlMatches } from '../../services/fantasy/autoLink';
import { basePositions, isGoalie, isNhlLinked, positionLabel } from '../../services/fantasy/positions';
import { formatValue } from '../../services/fantasy/scoring';
import { slotsLabel } from '../../services/fantasy/lineup';
import { MAX_ROSTER_PLAYERS, PLATFORM_LABEL, removePlayer, replacePlayer } from '../../services/teams';
import { seasonLabel } from '../../services/nhl/dates';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import PlayerSearchSheet, { toFantasyPlayer, type SearchMode } from '../sheets/PlayerSearchSheet';
import LeagueSettingsSheet from '../sheets/LeagueSettingsSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import SampleTeamNotice from '../coach/SampleTeamNotice';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { Card, ColdBadge, colors, Columns, contentFrame, display, EmptyState, GhostButton, HotBadge, IconButton, LoadingRows, PrimaryButton, SectionLabel } from '../coach/ui';
import { ART } from '../../constants/art';

type Group = 'F' | 'D' | 'G';

function groupOf(player: FantasyPlayer): Group {
  if (isGoalie(player)) return 'G';
  const positions = basePositions(player);
  return positions.includes('D') && !positions.some((pos) => pos !== 'D') ? 'D' : 'F';
}

const GROUP_TITLE: Record<Group, string> = { F: 'Forwards', D: 'Defense', G: 'Goalies' };

export default function RosterScreen() {
  const { team, ready, updateTeam } = useTeams();
  const { openPlayer } = usePlayerSheet();
  // Preseason, All-Star break, Sunday night: count next week's games instead of a column of zeros.
  const lookAhead = useWeekHasGamesLeft(useNhlToday()) === false;
  const week = useWeekData(team, lookAhead ? 1 : 0);
  const [search, setSearch] = useState<SearchMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const forms = week.forms.data?.forms;
  const plan = week.plan;
  const linked = useMemo(() => (team?.players ?? []).filter((player) => isNhlLinked(player)), [team]);
  const unlinked = useMemo(() => (team?.players ?? []).filter((player) => !isNhlLinked(player)), [team]);
  const groups = useMemo(() => {
    const out: Record<Group | 'IR', FantasyPlayer[]> = { F: [], D: [], G: [], IR: [] };
    for (const player of linked) {
      if (player.injuredReserve) out.IR.push(player);
      else out[groupOf(player)].push(player);
    }
    for (const key of Object.keys(out) as Array<keyof typeof out>) {
      out[key].sort((a, b) => (forms?.get(b.playerId)?.value ?? 0) - (forms?.get(a.playerId)?.value ?? 0));
    }
    return out;
  }, [linked, forms]);

  const autoLink = async () => {
    if (!team) return;
    setLinking(true);
    try {
      const matches = await findExactNhlMatches(unlinked);
      if (matches.size > 0) {
        updateTeam((current) => {
          let next = current;
          for (const [oldId, match] of matches) next = replacePlayer(next, oldId, toFantasyPlayer(match));
          return next;
        });
      }
      const left = unlinked.length - matches.size;
      Alert.alert(
        matches.size > 0 ? `Linked ${matches.size} ${matches.size === 1 ? 'player' : 'players'}` : 'No exact matches',
        left > 0 ? `${left} still need a tap — pick the right NHL player for each.` : 'Every name is linked to an NHL player now.',
      );
    } finally {
      setLinking(false);
    }
  };

  const confirmRemoveUnlinked = (player: FantasyPlayer) => {
    Alert.alert(player.playerName, 'Link to an NHL player, or remove this name?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateTeam((current) => removePlayer(current, player.playerId)) },
      { text: 'Link', onPress: () => setSearch({ kind: 'link', player }) },
    ]);
  };

  if (!ready) {
    return (
      <View style={styles.container}>
        <PageHeader title="Roster" />
        <View style={styles.padded}><LoadingRows count={6} /></View>
      </View>
    );
  }

  const renderRow = (player: FantasyPlayer) => {
    const form = forms?.get(player.playerId);
    const games = plan?.players[player.playerId];
    return (
      <Pressable
        key={player.playerId}
        onPress={() => openPlayer(player.playerId, 'roster')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        testID={`roster-row-${player.playerId}`}
      >
        <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={50} />
        <View style={styles.rowText}>
          <PlayerName name={player.playerName} size={16} />
          <Text style={styles.meta}>
            {positionLabel(player)} · {player.teamAbbrev || 'No team'}
            {form && form.basis !== 'none' ? ` · ${formatValue(form.seasonRate)}/${form.isGoalie ? 'start' : 'gm'}` : ''}
            {form?.basis === 'previous' && week.forms.data ? ` (${seasonLabel(week.forms.data.previousSeasonId)})` : ''}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {games ? <Text style={styles.games}>{lookAhead ? games.games : games.remainingGames}</Text> : null}
          {games ? <Text style={styles.gamesLabel}>{lookAhead ? 'NEXT WK' : 'LEFT'}</Text> : null}
        </View>
        {form?.trend === 'hot' ? <HotBadge /> : null}
        {form?.trend === 'cold' ? <ColdBadge /> : null}
      </Pressable>
    );
  };

  const renderGroup = (group: Group) => (groups[group].length > 0 ? (
    <View key={group}>
      <SectionLabel title={`${GROUP_TITLE[group]} (${groups[group].length})`} right={<Text style={styles.hint}>{lookAhead ? 'GAMES NEXT WEEK' : 'GAMES LEFT'}</Text>} />
      <Card style={styles.groupCard}>{groups[group].map(renderRow)}</Card>
    </View>
  ) : null);

  if (!team || team.players.length === 0) {
    return (
      <View style={styles.container} testID="roster-empty">
        <PageHeader title="Roster" accessory={<TeamSwitcher />} />
        <EmptyState
          art={ART.emptyRoster}
          title="Build your roster"
          body="Search NHL players and add everyone on your fantasy team — bench and IR included."
          action={<PrimaryButton label="Add players" icon="add" onPress={() => setSearch({ kind: 'add', list: 'players' })} testID="roster-add-first" />}
        />
        {search ? <PlayerSearchSheet visible mode={search} onClose={() => setSearch(null)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="roster-screen">
      <PageHeader
        title="Roster"
        accessory={<TeamSwitcher />}
        right={<IconButton icon="add" label="Add players" onPress={() => setSearch({ kind: 'add', list: 'players' })} testID="roster-add" />}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={week.refreshing} onRefresh={week.refresh} tintColor={colors.accent} />}
      >
        <SampleTeamNotice />

        <Card style={styles.leagueCard} onPress={() => setSettingsOpen(true)} testID="roster-league-settings">
          <View style={styles.leagueText}>
            <Text style={styles.leagueTitle}>{PLATFORM_LABEL[team.platform]} league rules</Text>
            <Text style={styles.leagueMeta}>{slotsLabel(team.slots)}</Text>
          </View>
          <Ionicons name="options" size={18} color={colors.onInk} />
        </Card>

        {unlinked.length > 0 ? (
          <>
            <SectionLabel title={`Needs linking (${unlinked.length})`} />
            <Card style={styles.unlinkedCard}>
              <Text style={styles.unlinkedCopy}>
                These names were typed in an older PuckIQ. Link each to the real NHL player so schedules and stats load.
              </Text>
              <GhostButton
                label={linking ? 'Linking…' : 'Auto-link exact matches'}
                icon="flash-outline"
                onPress={autoLink}
                style={styles.autoLink}
                testID="roster-auto-link"
              />
              {unlinked.map((player) => (
                <Pressable
                  key={player.playerId}
                  onPress={() => setSearch({ kind: 'link', player })}
                  onLongPress={() => confirmRemoveUnlinked(player)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID={`unlinked-${player.playerId}`}
                >
                  <View style={styles.unlinkedIcon}>
                    <Ionicons name="link" size={16} color={colors.warn} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{player.playerName}</Text>
                    <Text style={styles.meta}>Tap to link · hold to remove</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.sub} />
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

        <Columns
          left={renderGroup('F')}
          right={(
            <>
              {renderGroup('D')}
              {renderGroup('G')}
              {groups.IR.length > 0 ? (
                <View>
                  <SectionLabel title={`IR (${groups.IR.length})`} />
                  <Card style={styles.groupCard}>{groups.IR.map(renderRow)}</Card>
                </View>
              ) : null}
            </>
          )}
        />

        <Text style={styles.footer}>
          {team.players.length} of {MAX_ROSTER_PLAYERS} players · tap a player for eligibility, IR, and game log
        </Text>
      </ScrollView>

      {search ? <PlayerSearchSheet visible mode={search} onClose={() => setSearch(null)} /> : null}
      <LeagueSettingsSheet visible={settingsOpen} team={team} onClose={() => setSettingsOpen(false)} />
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  leagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: colors.ink,
  },
  leagueText: {
    flex: 1,
  },
  leagueTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onInk,
  },
  leagueMeta: {
    fontSize: 13,
    color: colors.onInkSub,
    marginTop: 2,
  },
  unlinkedCard: {
    borderColor: `${colors.warn}44`,
    borderWidth: 1,
  },
  unlinkedCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  autoLink: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 4,
  },
  unlinkedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.warn}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'center',
    minWidth: 34,
  },
  games: {
    ...display(24),
  },
  gamesLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  hint: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  footer: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 20,
  },
});
