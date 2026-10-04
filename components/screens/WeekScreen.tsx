/**
 * Week — every player's games Mon–Sun, off-nights, and (Pro) the games that
 * actually count once your lineup slots fill up. Plus the head-to-head edge.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNhlToday, useWeekData, useWeekHasGamesLeft } from '../../hooks/useCoach';
import { formatValue } from '../../services/fantasy/scoring';
import { isNhlLinked, positionLabel } from '../../services/fantasy/positions';
import { shortDate, weekRangeLabel } from '../../services/nhl/dates';
import type { DayPlan, WeekPlan } from '../../services/fantasy/weekPlan';
import type { FantasyPlayer } from '../../types/fantasy';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import PlayerSearchSheet from '../sheets/PlayerSearchSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { ShareButton, ShareCardSheet, type ShareCardContent } from '../share/ShareCards';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import {
  Card,
  colors,
  contentFrame,
  DarkCard,
  display,
  EmptyState,
  ErrorState,
  GhostButton,
  LoadingRows,
  Pill,
  ProLockCard,
  SectionLabel,
  SegmentedControl,
  StatCell,
} from '../coach/ui';
import { ART, ART_ASPECT } from '../../constants/art';
import { trackedChoice } from '../../services/analytics/selection';

type WeekChoice = 'this' | 'next';

function cellState(plan: WeekPlan, day: DayPlan, playerId: number): 'start' | 'bench' | 'none' {
  if (!day.playing.includes(playerId)) return 'none';
  if (day.bench.includes(playerId)) return 'bench';
  return 'start';
}

export default function WeekScreen() {
  const { team, ready } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const today = useNhlToday();
  // Preseason, All-Star break, Sunday night: next week is the only week that matters, so it's free
  // and it's where the screen opens.
  const emptyThisWeek = useWeekHasGamesLeft(today) === false;
  const [picked, setChoice] = useState<WeekChoice | null>(null);
  const choice: WeekChoice = picked ?? (emptyThisWeek ? 'next' : 'this');
  const [addingOpponent, setAddingOpponent] = useState(false);
  const [sharing, setSharing] = useState(false);
  const week = useWeekData(team, choice === 'this' ? 0 : 1);
  const plan = week.plan;

  const rows = useMemo(() => {
    if (!team || !plan) return [] as FantasyPlayer[];
    return team.players
      .filter((player) => isNhlLinked(player) && !player.injuredReserve)
      .sort((a, b) => (plan.players[b.playerId]?.games ?? 0) - (plan.players[a.playerId]?.games ?? 0) || a.playerName.localeCompare(b.playerName));
  }, [team, plan]);

  const onChoice = (next: WeekChoice) => {
    if (next === 'next' && !isPremium && !emptyThisWeek) {
      openPaywall('week_next');
      return;
    }
    setChoice(next);
  };

  if (!ready) {
    return (
      <View style={styles.container}>
        <PageHeader title="Week" />
        <View style={styles.padded}><LoadingRows count={6} /></View>
      </View>
    );
  }

  if (!team || team.players.length === 0) {
    return (
      <View style={styles.container}>
        <PageHeader title="Week" accessory={<TeamSwitcher />} />
        <EmptyState art={ART.emptyRoster} title="No roster yet" body="Add your players on the Roster tab to see their week." />
      </View>
    );
  }

  const totals = choice === 'this' ? plan?.remaining : plan?.week;
  const offNights = plan?.days.filter((day) => day.offNight).length ?? 0;
  const matchup = week.matchup;
  const shareGames = plan ? (choice === 'this' ? plan.remaining.games : plan.week.games) : 0;
  const shareContent: ShareCardContent | null = plan && shareGames > 0 ? {
    kind: 'week',
    kicker: weekRangeLabel(week.monday).toUpperCase(),
    teamName: team.name,
    count: shareGames,
    caption: choice === 'this' ? 'games left this week' : 'games next week',
    players: rows
      .map((player) => ({ player, games: (choice === 'this' ? plan.players[player.playerId]?.remainingGames : plan.players[player.playerId]?.games) ?? 0 }))
      .filter((row) => row.games > 0)
      .sort((a, b) => b.games - a.games)
      .map(({ player, games }) => ({
        playerId: player.playerId,
        name: player.playerName,
        team: player.teamAbbrev,
        position: player.position,
        detail: choice === 'this' ? `${games} left` : `${games} GP`,
      })),
  } : null;

  return (
    <View style={styles.container} testID="week-screen">
      <PageHeader
        title="Week"
        accessory={<TeamSwitcher />}
        right={(
          <SegmentedControl<WeekChoice>
            value={choice}
            onChange={trackedChoice('week', 'week', onChoice)}
            options={[{ value: 'this', label: 'This' }, { value: 'next', label: 'Next', locked: !isPremium && !emptyThisWeek }]}
            testID="week-toggle"
            style={{ width: 136 }}
          />
        )}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={week.refreshing} onRefresh={week.refresh} tintColor={colors.accent} />}
      >
        {emptyThisWeek && choice === 'this' ? (
          <Card onPress={() => setChoice('next')} style={styles.emptyWeek} testID="week-empty-notice">
            <Image source={ART.checkeredFlag} style={styles.weekDoneFlag} contentFit="contain" accessible={false} />
            <View style={styles.emptyWeekText}>
              <Text style={styles.emptyWeekTitle}>No NHL games left this week</Text>
              <Text style={styles.emptyWeekBody}>Plan next week instead →</Text>
            </View>
          </Card>
        ) : null}

        {week.error && !plan ? <ErrorState body="The NHL schedule didn’t load. Check your connection and try again." onRetry={week.refresh} /> : null}
        {week.loading && !plan ? <LoadingRows count={6} /> : null}

        {plan ? (
          <>
            <DarkCard texture style={styles.summary} testID="week-summary">
              <View style={styles.kickerRow}>
                <View style={styles.kickerDot} />
                <Text style={styles.kicker}>{weekRangeLabel(week.monday).toUpperCase()}</Text>
                {shareContent ? <View style={styles.kickerSpacer} /> : null}
                {shareContent ? <ShareButton onPress={() => setSharing(true)} testID="week-share" /> : null}
              </View>
              {isPremium ? (
                <>
                  <View style={styles.bigRow}>
                    <Text style={styles.summaryBig}>{totals?.starts ?? 0}</Text>
                    <Text style={styles.summarySub}>
                      {choice === 'this' ? 'games that count\nleft this week' : 'games that count\nnext week'}
                    </Text>
                  </View>
                  <View style={styles.summaryStats}>
                    <StatCell dark size={24} value={String(totals?.games ?? 0)} label="Games" />
                    <StatCell dark size={24} value={String(totals?.benched ?? 0)} label="Lost to bench" tone={(totals?.benched ?? 0) > 0 ? 'warn' : 'neutral'} testID="week-benched" />
                    <StatCell dark size={24} value={String(totals?.emptySlots ?? 0)} label="Empty slots" tone={(totals?.emptySlots ?? 0) > 0 ? 'warn' : 'neutral'} testID="week-empty" />
                  </View>
                  {team.minGoalieStarts > 0 ? (
                    <View style={styles.goalieRow} testID="week-goalie-min">
                      <Ionicons
                        name={plan.week.goalieStarts >= team.minGoalieStarts ? 'checkmark-circle' : 'alert-circle'}
                        size={16}
                        color={plan.week.goalieStarts >= team.minGoalieStarts ? colors.good : colors.warn}
                      />
                      <Text style={styles.goalieText}>
                        ~{plan.week.goalieStarts.toFixed(1)} expected goalie starts · league minimum {team.minGoalieStarts}
                        {plan.week.goalieStarts < team.minGoalieStarts ? ' — stream a goalie' : ''}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.bigRow}>
                    <Text style={styles.summaryBig}>{plan.remaining.games}</Text>
                    <Text style={styles.summarySub}>
                      {choice === 'this' ? `games left this week\n${plan.week.games} total · ${offNights} off-nights` : `games next week\n${offNights} off-nights`}
                    </Text>
                  </View>
                  <Pressable onPress={() => openPaywall('week_planner')} style={styles.summaryLock} testID="week-planner-locked">
                    <Ionicons name="lock-closed" size={13} color={colors.onInk} />
                    <Text style={styles.summaryLockText}>How many actually count after lineup limits?</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.onInk} />
                  </Pressable>
                </>
              )}
            </DarkCard>

            <SectionLabel title="Schedule" right={<View style={styles.legendRow}><View style={styles.legendSwatch} /><Text style={styles.legend}>Off-night</Text></View>} />
            <Card style={styles.grid} testID="week-grid">
              <View style={styles.gridRow}>
                <View style={[styles.nameCell, styles.headCell]} />
                {plan.days.map((day) => (
                  <View key={day.date} style={[styles.dayCell, day.offNight && styles.offNightCol]}>
                    <View style={[styles.dayBadge, day.isToday && styles.todayBadge]}>
                      <Text style={[styles.dayHead, day.isPast && styles.past, day.isToday && styles.todayText]}>{day.dayAbbrev.slice(0, 2)}</Text>
                      <Text style={[styles.dayNum, day.isPast && styles.past, day.isToday && styles.todayText]}>{shortDate(day.date).split(' ')[1]}</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.totalCell}>
                  <Text style={styles.dayHead}>GP</Text>
                </View>
              </View>
              {rows.map((player) => {
                const summary = plan.players[player.playerId];
                return (
                  <Pressable
                    key={player.playerId}
                    style={({ pressed }) => [styles.gridRow, styles.playerRow, pressed && styles.pressed]}
                    onPress={() => openPlayer(player.playerId, 'roster')}
                    testID={`week-row-${player.playerId}`}
                  >
                    <View style={[styles.nameCell, styles.nameWithTile]}>
                      <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={30} />
                      <View style={styles.nameText}>
                        <Text style={styles.lastName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                          {player.playerName.split(' ').slice(-1)[0].toUpperCase()}
                        </Text>
                        <Text style={styles.pos}>{positionLabel(player)} · {player.teamAbbrev}</Text>
                      </View>
                    </View>
                    {plan.days.map((day) => {
                      const game = summary?.byDate[day.date];
                      const state = cellState(plan, day, player.playerId);
                      return (
                        <View key={day.date} style={[styles.dayCell, day.offNight && styles.offNightCol]}>
                          {game ? (
                            <View
                              style={[
                                styles.gameChip,
                                isPremium && state === 'bench' && styles.benchChip,
                                day.isPast && styles.pastChip,
                              ]}
                            >
                              <Text style={[styles.gameText, isPremium && state === 'bench' && styles.benchText]} numberOfLines={1}>
                                {game.opponent}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <View style={styles.totalCell}>
                      <Text style={styles.total}>{summary?.games ?? 0}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={[styles.gridRow, styles.footRow]}>
                <View style={styles.nameCell}>
                  <Text style={styles.footLabel}>PLAYING</Text>
                </View>
                {plan.days.map((day) => (
                  <View key={day.date} style={styles.dayCell}>
                    <Text style={styles.footValue}>{day.leagueGames > 0 ? day.playing.length : '–'}</Text>
                  </View>
                ))}
                <View style={styles.totalCell}>
                  <Text style={styles.total}>{plan.week.games}</Text>
                </View>
              </View>
              {isPremium ? (
                <View style={[styles.gridRow, styles.footRow]}>
                  <View style={styles.nameCell}>
                    <Text style={styles.footLabel}>EMPTY SLOTS</Text>
                  </View>
                  {plan.days.map((day) => (
                    <View key={day.date} style={styles.dayCell}>
                      <Text style={[styles.footValue, day.empty.length > 0 && styles.warnText]}>{day.leagueGames > 0 ? day.empty.length : '–'}</Text>
                    </View>
                  ))}
                  <View style={styles.totalCell}>
                    <Text style={[styles.total, plan.week.emptySlots > 0 && styles.warnText]}>{plan.week.emptySlots}</Text>
                  </View>
                </View>
              ) : null}
            </Card>
            <Text style={styles.footnote}>
              {isPremium
                ? 'Amber = plays but your slots at his positions are full that night. Off-nights have 7 or fewer NHL games.'
                : 'Off-nights have 7 or fewer NHL games — your streamers there rarely collide with the rest of your lineup.'}
            </Text>

            <SectionLabel title="Matchup" />
            {!isPremium ? (
              <ProLockCard
                title="Your games vs your opponent’s"
                detail="Add their roster once and see who has more games that count left — and which nights to stream."
                onPress={() => openPaywall('matchup')}
                testID="matchup-locked"
              />
            ) : team.opponent.length === 0 ? (
              <Card>
                <Text style={styles.matchupEmpty}>Add this week’s opponent’s players to compare games left under the same lineup rules.</Text>
                <GhostButton label="Add opponent’s players" icon="person-add-outline" onPress={() => setAddingOpponent(true)} style={styles.matchupButton} testID="matchup-add" />
              </Card>
            ) : matchup && week.opponentPlan ? (
              <DarkCard testID="matchup-card">
                <View style={styles.matchupHead}>
                  {matchup.verdict === 'ahead' ? (
                    <Image source={ART.trophy} style={styles.matchupTrophy} contentFit="contain" accessible={false} testID="matchup-trophy" />
                  ) : null}
                  <Pill
                    label={matchup.verdict === 'ahead' ? 'AHEAD' : matchup.verdict === 'behind' ? 'BEHIND' : 'EVEN'}
                    tone={matchup.verdict === 'ahead' ? 'good' : matchup.verdict === 'behind' ? 'bad' : 'muted'}
                    solid
                  />
                  <Text style={styles.matchupTitle} numberOfLines={1}>vs {team.opponentName || 'Opponent'}</Text>
                  <Pressable onPress={() => setAddingOpponent(true)} hitSlop={8}>
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                </View>
                <View style={styles.matchupStats}>
                  <View style={styles.matchupCol}>
                    <Text style={styles.matchupLabel}>YOU</Text>
                    <Text style={styles.matchupValue}>{matchup.mine.starts}</Text>
                    <Text style={styles.matchupSub}>{formatValue(matchup.mine.value)} proj</Text>
                  </View>
                  <View style={[styles.matchupCol, styles.alignCenter]}>
                    <Text style={[styles.matchupEdge, { color: matchup.startEdge >= 0 ? colors.good : colors.accent }]}>
                      {matchup.startEdge > 0 ? '+' : ''}{matchup.startEdge}
                    </Text>
                    <Text style={styles.matchupLabel}>GAMES THAT COUNT</Text>
                  </View>
                  <View style={[styles.matchupCol, styles.alignEnd]}>
                    <Text style={styles.matchupLabel}>THEM</Text>
                    <Text style={styles.matchupValue}>{matchup.theirs.starts}</Text>
                    <Text style={styles.matchupSub}>{formatValue(matchup.theirs.value)} proj</Text>
                  </View>
                </View>
                <View style={styles.dayCompare}>
                  {plan.days.map((day, index) => {
                    const theirs = week.opponentPlan!.days[index];
                    return (
                      <View key={day.date} style={[styles.compareCell, day.isPast && styles.pastChip]}>
                        <Text style={styles.compareHead}>{day.dayAbbrev.slice(0, 2)}</Text>
                        <Text style={[styles.compareMine, day.starters.length > theirs.starters.length && styles.goodText]}>{day.starters.length}</Text>
                        <Text style={styles.compareTheirs}>{theirs.starters.length}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.darkFootnote}>Remaining days only. Same lineup slots and scoring for both sides.</Text>
              </DarkCard>
            ) : (
              <LoadingRows count={2} />
            )}
          </>
        ) : null}
      </ScrollView>
      <PlayerSearchSheet visible={addingOpponent} mode={{ kind: 'add', list: 'opponent' }} onClose={() => setAddingOpponent(false)} />
      <ShareCardSheet visible={sharing} content={shareContent} onClose={() => setSharing(false)} />
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
    paddingHorizontal: 12,
    paddingBottom: 130,
  },
  summary: {
    gap: 14,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekDoneFlag: {
    height: 40,
    width: 40 * ART_ASPECT.checkeredFlag,
  },
  kickerSpacer: {
    flex: 1,
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.onInk,
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  summaryBig: {
    ...display(72),
    color: colors.onInk,
    lineHeight: 76,
    letterSpacing: -3,
  },
  summarySub: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.onInk,
    paddingBottom: 10,
  },
  summaryStats: {
    flexDirection: 'row',
  },
  goalieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalieText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onInkSub,
  },
  summaryLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLockText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.onInk,
  },
  emptyWeek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  emptyWeekText: {
    flex: 1,
  },
  emptyWeekTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emptyWeekBody: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EFEAE2',
    borderWidth: 1,
    borderColor: '#DDD6CB',
  },
  legend: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sub,
  },
  grid: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  nameCell: {
    width: 116,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  nameWithTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  nameText: {
    flex: 1,
  },
  lastName: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  headCell: {
    height: 40,
  },
  pos: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 1,
  },
  dayCell: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  offNightCol: {
    backgroundColor: '#F4F0E9',
  },
  dayBadge: {
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 3,
    minWidth: 30,
  },
  todayBadge: {
    backgroundColor: colors.ink,
  },
  todayText: {
    color: colors.onInk,
    opacity: 1,
  },
  dayHead: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  past: {
    opacity: 0.35,
  },
  gameChip: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bg,
    minWidth: 32,
    alignItems: 'center',
  },
  benchChip: {
    backgroundColor: `${colors.warn}2A`,
  },
  pastChip: {
    opacity: 0.35,
  },
  gameText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.text,
  },
  benchText: {
    color: colors.warn,
  },
  totalCell: {
    width: 30,
    alignItems: 'center',
  },
  total: {
    ...display(16),
  },
  footRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 34,
  },
  footLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  footValue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.sub,
  },
  warnText: {
    color: colors.warn,
  },
  goodText: {
    color: colors.good,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 8,
    marginHorizontal: 4,
  },
  darkFootnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onInkSub,
    marginTop: 12,
  },
  matchupEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
  },
  matchupButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  matchupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchupTrophy: {
    height: 30,
    width: 30 * ART_ASPECT.trophy,
  },
  matchupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.onInk,
  },
  edit: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  matchupStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  matchupCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignCenter: {
    alignItems: 'center',
  },
  matchupLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.onInkSub,
  },
  matchupValue: {
    ...display(44),
    color: colors.onInk,
  },
  matchupSub: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  matchupEdge: {
    ...display(32),
  },
  dayCompare: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 4,
  },
  compareCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.inkRaised,
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
  },
  compareHead: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.onInkSub,
  },
  compareMine: {
    ...display(16),
    color: colors.onInk,
  },
  compareTheirs: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onInkSub,
  },
});
