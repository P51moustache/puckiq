/**
 * Week — every player's games Mon–Sun as an F1 tyre-strategy chart, off-nights, and
 * (Pro) the games that actually count once your lineup slots fill up. Plus the
 * head-to-head edge. Data and state live here; components/week/ renders the parts.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNhlToday, useWeekData, useWeekHasGamesLeft } from '../../hooks/useCoach';
import type { FantasyPlayer } from '../../types/fantasy';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import PlayerSearchSheet from '../sheets/PlayerSearchSheet';
import { HowItWorksButton } from '../sheets/HowItWorksSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { ShareCardSheet } from '../share/ShareCards';
import {
  Card,
  colors,
  contentFrame,
  EmptyState,
  ErrorState,
  LoadingRows,
  SectionLabel,
  SegmentedControl,
} from '../coach/ui';
import { ART, ART_ASPECT } from '../../constants/art';
import { trackedChoice } from '../../services/analytics/selection';
import { MatchupSection } from '../week/MatchupSection';
import { ScheduleKey } from '../week/ScheduleKey';
import { StintGrid } from '../week/StintGrid';
import { scheduleRows } from '../week/stints';
import type { WeekChoice } from '../week/types';
import { WeekHero } from '../week/WeekHero';
import { weekShareContent } from '../week/weekShare';

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

  const rows = useMemo(() => (team && plan ? scheduleRows(team.players, plan) : ([] as FantasyPlayer[])), [team, plan]);
  const openRow = useCallback((playerId: number) => openPlayer(playerId, 'roster'), [openPlayer]);

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

  const shareContent = plan ? weekShareContent({ plan, rows, choice, monday: week.monday, teamName: team.name }) : null;

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
            <WeekHero
              plan={plan}
              choice={choice}
              monday={week.monday}
              isPremium={isPremium}
              minGoalieStarts={team.minGoalieStarts}
              onShare={shareContent ? () => setSharing(true) : null}
              onUnlock={() => openPaywall('week_planner')}
            />

            <SectionLabel title="Schedule" right={<ScheduleKey detailed={isPremium} />} />
            <StintGrid plan={plan} rows={rows} detailed={isPremium} onOpenPlayer={openRow} />

            <SectionLabel title="Matchup" right={<HowItWorksButton topic="week" testID="how-week-matchup-button" />} />
            <MatchupSection
              team={team}
              isPremium={isPremium}
              plan={plan}
              opponentPlan={week.opponentPlan}
              matchup={week.matchup}
              onEditOpponent={() => setAddingOpponent(true)}
              onUnlock={() => openPaywall('matchup')}
            />
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
  weekDoneFlag: {
    height: 40,
    width: 40 * ART_ASPECT.checkeredFlag,
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
});
