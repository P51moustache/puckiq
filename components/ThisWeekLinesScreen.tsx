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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BARN_NAME, barn, barnLines, boardHero, splitHero } from '../constants/barn';
import RinkMarkings from './RinkMarkings';
import { useGroupedRosterPlayers, useWeeklyLines } from '../hooks/useWeeklyLines';
import { formatLockCountdown } from '../services/lockCountdown';
import { CONFIDENCE_LABEL } from '../services/tonightRoster';
import { cannotStart } from '../services/weeklyLines';
import type { FantasyPlayer, StartSitRec, TonightPlayerStatus } from '../types/fantasy';
import type { LineGroup } from '../types/lines';
import MyWeekStrip from './MyWeekStrip';
import NhlPlayerSearch from './NhlPlayerSearch';
import RosterBuilder from './RosterBuilder';

const REC_BADGE: Record<StartSitRec, { fill: boolean; color: string; label: string }> = {
  START: { fill: true, color: barn.signal, label: 'START' },
  SIT: { fill: false, color: barn.ghost, label: 'SIT' },
  UPSIDE: { fill: false, color: barn.heat, label: 'TAPE' },
  FLEX: { fill: false, color: barn.ghost, label: 'FLEX' },
};

const GROUPS: { key: LineGroup; title: string; testID: string }[] = [
  { key: 'F', title: 'F', testID: 'lines-group-F' },
  { key: 'D', title: 'D', testID: 'lines-group-D' },
  { key: 'G', title: 'G', testID: 'lines-group-G' },
  { key: 'bench', title: 'BN', testID: 'lines-group-bench' },
];

const GROUP_CHIPS: { key: LineGroup; label: string }[] = [
  { key: 'F', label: 'F' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
  { key: 'bench', label: 'BN' },
];

function nextGameLabel(status?: TonightPlayerStatus): string {
  if (!status) return '';
  if (status.injurySignal === 'out') return barnLines.injuredStarter;
  if (status.injurySignal === 'scratch') return barnLines.scratch;
  if (status.injurySignal === 'dtd') return 'DTD. Your call.';
  if (!status.opponentAbbrev) {
    return status.teamAbbrev ? `${status.teamAbbrev} · off` : '';
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
      <View style={styles.playerHead}>
        <View style={styles.playerText}>
          <Text style={styles.playerName}>{player.playerName}</Text>
          <Text style={styles.playerMeta}>
            {[player.position || '—', player.teamAbbrev].filter(Boolean).join(' · ')}
          </Text>
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
      </View>
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
                (REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).fill
                  ? styles.recBadgeFill
                  : styles.recBadgeGhost,
                { borderColor: (REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).color },
              ]}
            >
              <Text
                style={[
                  styles.recBadgeText,
                  (REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).fill
                    ? styles.recBadgeTextFill
                    : { color: (REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).color },
                ]}
              >
                {(REC_BADGE[status.recommendation] ?? REC_BADGE.FLEX).label}
              </Text>
            </View>
          ) : null}
          <Text style={styles.coachMeta}>
            {[
              status.opponentAbbrev
                ? formatLockCountdown(status.startTimeUTC, undefined, status.gameState)
                : null,
              status.confidence === 'unknown' ? null : CONFIDENCE_LABEL[status.confidence],
              status.reason === 'No game tonight' || status.reason === 'Has a game tonight'
                ? null
                : status.reason,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : null}
      {pairLocked ? (
        <Text style={styles.pairWarn} testID={`lines-pair-warn-${player.playerId}`}>
          {barnLines.pair}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => onPair(player.playerId)}
        style={[styles.pairChip, pairingFrom && styles.pairChipActive]}
        testID={`lines-pair-${player.playerId}`}
      >
        <Text style={styles.pairChipLabel}>
          {pairingFrom ? 'The other name' : 'Do not pair'}
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
  const insets = useSafeAreaInsets();
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
      barnLines.lastWeek,
      'Stick it on this week.',
      [
        { text: 'Leave it', style: 'cancel' },
        { text: 'Stick it', onPress: () => { copyLastWeek(); } },
      ],
    );
  }, [canCopyLastWeek, copyLastWeek]);

  const handleSaved = useCallback(() => {
    setShowBuilder(false);
    onRefresh();
  }, [onRefresh]);

  const statusList = Object.values(statuses);
  const injured = statusList.find((row) => row.injurySignal === 'out');
  const scratched = statusList.find((row) => row.injurySignal === 'scratch');
  const hero = boardHero({
    hasRoster,
    injuredName: injured?.playerName,
    scratchName: scratched?.playerName,
    moveAction: headline?.primaryMove?.action,
    moveName: headline?.primaryMove?.playerName,
    playing: headline?.playing,
  });

  if (isLoading) {
    return (
      <View style={styles.centered} testID="lines-loading">
        <ActivityIndicator size="large" color={barn.signal} />
        <Text style={styles.loadingCopy}>{barnLines.loading}</Text>
      </View>
    );
  }

  const [heroTop, heroBottom] = splitHero(hero);

  return (
    <View style={styles.container} testID="this-week-lines-screen">
      <RinkMarkings />
      <View style={[styles.wordmark, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmarkName} testID="page-header-title">{BARN_NAME}</Text>
        <Text style={styles.wordmarkObject}>{weekLabel || 'The board'}</Text>
        {hasRoster ? (
          <TouchableOpacity
            onPress={() => setShowBuilder(true)}
            style={styles.editButton}
            testID="lines-edit-roster"
          >
            <Text style={styles.editLabel}>BOARD</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.clip}>
        <View style={[styles.heroBlock, hasRoster && styles.heroBlockOnBoard]} testID="lines-hero">
          <Text style={[styles.hero, hasRoster && styles.heroOnBoard]}>{heroTop}</Text>
          {heroBottom ? (
            <Text style={[styles.hero, hasRoster && styles.heroOnBoard]}>{heroBottom}</Text>
          ) : null}
          <View style={[styles.centerIce, hasRoster && styles.centerIceOnBoard]} />
        </View>

      {!hasRoster ? (
        <View style={styles.empty} testID="lines-empty">
          <NhlPlayerSearch onAdd={addNhlPlayer} alreadyOnRoster={alreadyOnRoster} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {headline ? <View testID="lines-headline" /> : null}
          {headline?.primaryMove ? (
            <Text style={styles.headlineMove} testID="lines-primary-move">
              {headline.primaryMove.detail}
            </Text>
          ) : null}
          <MyWeekStrip week={week} today={slateDate} />
          {canCopyLastWeek ? (
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyLastWeek}
              disabled={false}
              testID="copy-last-week"
            >
              <Text style={styles.copyText}>{barnLines.lastWeek}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.copyButtonHidden}
              disabled
              testID="copy-last-week"
            />
          )}
          <Text style={styles.copyHint} testID="copy-last-week-hint">
            {canCopyLastWeek ? 'Stick it on this week.' : 'No tape from last week.'}
          </Text>
          {error ? <Text style={styles.error} testID="lines-error">{barnLines.error}</Text> : null}
          {brokenPairs.length > 0 ? (
            <Text style={styles.error} testID="lines-pair-banner">
              {barnLines.pair}
            </Text>
          ) : null}

          {GROUPS.map((section) => {
            const players = grouped[section.key];
            return (
              <View key={section.key} style={styles.section} testID={section.testID}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                {players.length === 0 ? (
                  <Text style={styles.sectionEmpty} testID={`${section.testID}-empty`}>
                    —
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
          <NhlPlayerSearch onAdd={addNhlPlayer} alreadyOnRoster={alreadyOnRoster} />
        </ScrollView>
      )}
      </View>

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
    backgroundColor: barn.ground,
  },
  centered: {
    flex: 1,
    backgroundColor: barn.ground,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingCopy: {
    color: barn.ink,
    fontFamily: barn.fonts.body,
    fontSize: 14,
  },
  wordmark: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    zIndex: 1,
  },
  wordmarkName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    color: barn.ink,
    fontFamily: barn.fonts.mono,
  },
  wordmarkObject: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 1.8,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  empty: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    gap: 12,
  },
  editButton: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: barn.ink,
    fontFamily: barn.fonts.mono,
  },
  clip: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 1,
  },
  heroBlock: {
    marginBottom: 40,
  },
  heroBlockOnBoard: {
    marginBottom: 16,
  },
  hero: {
    fontSize: 56,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  heroOnBoard: {
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -1,
  },
  centerIce: {
    marginTop: 20,
    height: 4,
    width: 88,
    backgroundColor: barn.signal,
    shadowColor: barn.signal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  centerIceOnBoard: {
    marginTop: 10,
    width: 56,
    height: 3,
  },
  copyButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  copyButtonHidden: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  copyText: {
    fontSize: 14,
    color: barn.ink,
    fontFamily: barn.fonts.body,
    textDecorationLine: 'underline',
  },
  copyHint: {
    fontSize: 14,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
    marginTop: -8,
  },
  error: {
    fontSize: 14,
    color: barn.signal,
    fontFamily: barn.fonts.body,
  },
  headlineMove: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: barn.fonts.body,
    color: barn.ink,
  },
  section: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: barn.ghost,
    marginBottom: 4,
    fontFamily: barn.fonts.display,
  },
  sectionEmpty: {
    fontSize: 14,
    color: barn.ghost,
    paddingVertical: 12,
    fontFamily: barn.fonts.body,
  },
  playerRow: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: barn.rule,
    paddingVertical: 12,
    gap: 6,
  },
  playerHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  playerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playerName: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  playerMeta: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  nextGame: {
    fontSize: 15,
    color: barn.ink,
    marginTop: 2,
    fontFamily: barn.fonts.body,
  },
  nextGameOut: {
    color: barn.signal,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  recBadge: {
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  recBadgeFill: {
    backgroundColor: barn.signal,
    borderColor: barn.signal,
  },
  recBadgeGhost: {
    backgroundColor: 'transparent',
  },
  recBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontFamily: barn.fonts.mono,
  },
  recBadgeTextFill: {
    color: barn.ink,
  },
  coachMeta: {
    flex: 1,
    fontSize: 13,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
  },
  pairWarn: {
    fontSize: 14,
    color: barn.signal,
    fontFamily: barn.fonts.body,
  },
  chips: {
    flexDirection: 'row',
    gap: 2,
    paddingTop: 4,
  },
  chip: {
    minWidth: 32,
    height: 36,
    paddingHorizontal: 2,
    borderRadius: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: barn.ink,
  },
  chipDisabled: {
    opacity: 0.28,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
  },
  chipLabelActive: {
    color: barn.ground,
  },
  pairChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 2,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  pairChipActive: {
    borderColor: barn.signal,
  },
  pairChipLabel: {
    fontSize: 14,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
    textDecorationLine: 'underline',
  },
});
