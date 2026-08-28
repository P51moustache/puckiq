/**
 * This week's lines — official NHL search, next-game, OUT lock, do-not-pair.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { useGroupedRosterPlayers, useWeeklyLines } from '../hooks/useWeeklyLines';
import { formatLockCountdown } from '../services/lockCountdown';
import { CONFIDENCE_LABEL } from '../services/tonightRoster';
import { cannotStart } from '../services/weeklyLines';
import type { FantasyPlayer, StartSitRec, TonightPlayerStatus } from '../types/fantasy';
import type { LineGroup } from '../types/lines';
import MyWeekStrip from './MyWeekStrip';
import NhlPlayerSearch from './NhlPlayerSearch';
import PageHeader from './PageHeader';
import RosterBuilder from './RosterBuilder';

const REC_BADGE: Record<StartSitRec, { color: string; label: string }> = {
  START: { color: rinkGlass.faceoffDot, label: 'START' },
  SIT: { color: rinkGlass.redLine, label: 'SIT' },
  UPSIDE: { color: rinkGlass.powerPlay, label: 'UPSIDE' },
  FLEX: { color: rinkGlass.blueLight, label: 'FLEX' },
};

const GROUPS: { key: LineGroup; title: string; testID: string }[] = [
  { key: 'F', title: 'Forwards', testID: 'lines-group-F' },
  { key: 'D', title: 'Defense', testID: 'lines-group-D' },
  { key: 'G', title: 'Goalies', testID: 'lines-group-G' },
  { key: 'bench', title: 'Bench', testID: 'lines-group-bench' },
];

const GROUP_CHIPS: { key: LineGroup; label: string }[] = [
  { key: 'F', label: 'F' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
  { key: 'bench', label: 'BN' },
];

function nextGameLabel(status?: TonightPlayerStatus): string {
  if (!status) return '';
  if (status.injurySignal === 'out') return 'OUT — cannot start';
  if (status.injurySignal === 'scratch') return 'Scratch — cannot start';
  if (status.injurySignal === 'dtd') return 'DTD — start only if you mean it';
  if (!status.opponentAbbrev) {
    return status.teamAbbrev ? `${status.teamAbbrev} · no game tonight` : '';
  }
  const vs = status.isHome ? `vs ${status.opponentAbbrev}` : `@ ${status.opponentAbbrev}`;
  let when = '';
  if (status.startTimeUTC) {
    when = new Date(status.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return `${status.teamAbbrev} ${vs}${when ? ` · ${when}` : ''}`;
}

function PlayerRow({
  player,
  group,
  status,
  pairLocked,
  pairingFrom,
  onAssign,
  onPair,
}: {
  player: FantasyPlayer;
  group: LineGroup;
  status?: TonightPlayerStatus;
  pairLocked: boolean;
  pairingFrom: boolean;
  onAssign: (playerId: number, group: LineGroup) => void;
  onPair: (playerId: number) => void;
}) {
  const locked = cannotStart(status?.injurySignal);
  return (
    <View style={styles.playerRow} testID={`lines-player-${player.playerId}`}>
      <View style={styles.playerText}>
        <Text style={styles.playerName}>{player.playerName}</Text>
        <Text style={styles.playerMeta}>
          {[player.position || '—', player.teamAbbrev].filter(Boolean).join(' · ')}
        </Text>
        {nextGameLabel(status) ? (
          <Text
            style={[styles.nextGame, locked && styles.nextGameOut]}
            testID={`lines-next-${player.playerId}`}
          >
            {nextGameLabel(status)}
          </Text>
        ) : null}
        {status ? (
          <View style={styles.coachRow} testID={`lines-coach-${player.playerId}`}>
            {status.recommendation ? (
              <View
                style={[
                  styles.recBadge,
                  { backgroundColor: (REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).color },
                ]}
              >
                <Text style={styles.recBadgeText}>
                  {(REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).label}
                </Text>
              </View>
            ) : null}
            <Text style={styles.coachMeta}>
              {[
                status.opponentAbbrev
                  ? formatLockCountdown(status.startTimeUTC, undefined, status.gameState)
                  : null,
                CONFIDENCE_LABEL[status.confidence],
                status.reason,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}
        {pairLocked ? (
          <Text style={styles.pairWarn} testID={`lines-pair-warn-${player.playerId}`}>
            Do-not-pair is on F with their lock
          </Text>
        ) : null}
      </View>
      <View style={styles.chips} testID={`lines-chips-${player.playerId}`}>
        {GROUP_CHIPS.map((chip) => {
          const active = group === chip.key;
          const blocked = locked && chip.key !== 'bench';
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => onAssign(player.playerId, chip.key)}
              disabled={blocked}
              style={[styles.chip, active && styles.chipActive, blocked && styles.chipDisabled]}
              testID={`lines-assign-${player.playerId}-${chip.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Put ${player.playerName} on ${chip.label}`}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={() => onPair(player.playerId)}
        style={[styles.pairChip, pairingFrom && styles.pairChipActive]}
        testID={`lines-pair-${player.playerId}`}
      >
        <Text style={styles.pairChipLabel}>
          {pairingFrom ? 'Tap the other name' : 'Do not pair'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ThisWeekLinesScreen() {
  const {
    isLoading,
    roster,
    hasRoster,
    weekLabel,
    canCopyLastWeek,
    error,
    statuses,
    headline,
    week,
    slateDate,
    brokenPairs,
    pairingFrom,
    groupOf,
    assign,
    addNhlPlayer,
    copyLastWeek,
    beginPair,
    onRefresh,
  } = useWeeklyLines();
  const grouped = useGroupedRosterPlayers(roster, groupOf);
  const [showBuilder, setShowBuilder] = useState(false);
  const alreadyOnRoster = useMemo(
    () => new Set((roster?.players ?? []).map((player) => player.playerId)),
    [roster],
  );
  const brokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of brokenPairs) {
      ids.add(row[0]);
      ids.add(row[1]);
    }
    return ids;
  }, [brokenPairs]);

  const handleAssign = useCallback(
    (playerId: number, group: LineGroup) => {
      assign(playerId, group);
    },
    [assign],
  );

  const handleCopyLastWeek = useCallback(() => {
    if (!canCopyLastWeek) return;
    Alert.alert(
      'Copy last week?',
      'This week’s slots will match last week. You can still tap to move players.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy', onPress: () => { copyLastWeek(); } },
      ],
    );
  }, [canCopyLastWeek, copyLastWeek]);

  const handleSaved = useCallback(() => {
    setShowBuilder(false);
    onRefresh();
  }, [onRefresh]);

  if (isLoading) {
    return (
      <View style={styles.centered} testID="lines-loading">
        <ActivityIndicator size="large" color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="this-week-lines-screen">
      <PageHeader
        title="This week's lines"
        subtitle={weekLabel ? `${weekLabel} · your roster` : 'Your roster · this week'}
        right={
          hasRoster ? (
            <TouchableOpacity
              onPress={() => setShowBuilder(true)}
              style={styles.editButton}
              testID="lines-edit-roster"
            >
              <Ionicons name="pencil" size={16} color={rinkGlass.blueLight} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {!hasRoster ? (
        <View style={styles.empty} testID="lines-empty">
          <Ionicons name="people-outline" size={48} color={rinkGlass.blueLight} />
          <Text style={styles.emptyTitle}>Add your roster</Text>
          <Text style={styles.emptyCopy}>
            Search the NHL list, then tap F. Real players — next game and scratches come with them.
          </Text>
          <NhlPlayerSearch onAdd={addNhlPlayer} alreadyOnRoster={alreadyOnRoster} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <NhlPlayerSearch onAdd={addNhlPlayer} alreadyOnRoster={alreadyOnRoster} />
          {headline ? (
            <View style={styles.headlineCard} testID="lines-headline">
              <Text style={styles.headlineText}>{headline.text}</Text>
              {headline.primaryMove ? (
                <Text style={styles.headlineMove} testID="lines-primary-move">
                  {`${headline.primaryMove.action} ${headline.primaryMove.playerName} — ${headline.primaryMove.detail}`}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.weekWrap}>
            <MyWeekStrip week={week} today={slateDate} />
          </View>
          <TouchableOpacity
            style={[styles.copyButton, !canCopyLastWeek && styles.copyButtonDisabled]}
            onPress={handleCopyLastWeek}
            disabled={!canCopyLastWeek}
            testID="copy-last-week"
          >
            <Ionicons
              name="copy-outline"
              size={16}
              color={canCopyLastWeek ? '#0a0e1a' : rinkGlass.textMuted}
            />
            <Text style={[styles.copyText, !canCopyLastWeek && styles.copyTextDisabled]}>
              Copy last week
            </Text>
          </TouchableOpacity>
          <Text style={styles.copyHint} testID="copy-last-week-hint">
            {canCopyLastWeek
              ? 'Last week is saved. Copy it forward, then tap to adjust.'
              : 'After this week, you can copy last week forward.'}
          </Text>
          {error ? <Text style={styles.error} testID="lines-error">{error}</Text> : null}
          {brokenPairs.length > 0 ? (
            <Text style={styles.error} testID="lines-pair-banner">
              Do-not-pair names are both on F. Move one.
            </Text>
          ) : null}

          {GROUPS.map((section) => {
            const players = grouped[section.key];
            return (
              <View key={section.key} style={styles.section} testID={section.testID}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                {players.length === 0 ? (
                  <Text style={styles.sectionEmpty} testID={`${section.testID}-empty`}>
                    Tap a player to put them here
                  </Text>
                ) : (
                  players.map((player) => (
                    <PlayerRow
                      key={player.playerId}
                      player={player}
                      group={section.key}
                      status={statuses[player.playerId]}
                      pairLocked={brokenIds.has(player.playerId)}
                      pairingFrom={pairingFrom === player.playerId}
                      onAssign={handleAssign}
                      onPair={beginPair}
                    />
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

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
  empty: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },
  emptyCopy: {
    fontSize: 15,
    color: rinkGlass.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${rinkGlass.blueLight}1F`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: rinkGlass.blueLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  copyButtonDisabled: {
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  copyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  copyTextDisabled: {
    color: rinkGlass.textMuted,
  },
  copyHint: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    color: rinkGlass.redLine,
    marginBottom: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: rinkGlass.blueLight,
    marginBottom: 8,
  },
  sectionEmpty: {
    fontSize: 13,
    color: rinkGlass.textMuted,
    paddingVertical: 8,
  },
  playerRow: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  playerText: {
    gap: 2,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  playerMeta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  nextGame: {
    fontSize: 12,
    color: rinkGlass.blueLight,
    marginTop: 2,
  },
  nextGameOut: {
    color: rinkGlass.redLine,
  },
  headlineCard: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 14,
    marginTop: 4,
    gap: 6,
  },
  headlineText: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    lineHeight: 24,
  },
  headlineMove: {
    fontSize: 13,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
  weekWrap: {
    marginHorizontal: -16,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  recBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },
  coachMeta: {
    flex: 1,
    fontSize: 12,
    color: rinkGlass.textSecondary,
  },
  pairWarn: {
    fontSize: 12,
    color: rinkGlass.redLine,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: rinkGlass.blueLight,
    borderColor: rinkGlass.blueLight,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
  chipLabelActive: {
    color: '#0a0e1a',
  },
  pairChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  pairChipActive: {
    borderColor: rinkGlass.blueLight,
  },
  pairChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
});
