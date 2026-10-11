import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useWeekData } from '../../hooks/useCoach';
import { startSharesOf, valuesOf } from '../../services/fantasy/loaders';
import { findTrades } from '../../services/league/trades';
import { otherMembers } from '../../services/league';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { useLeague } from '../league/LeagueProvider';
import { TradeIdeasCard } from '../league/TradeIdeasCard';
import { useTradeIdeas } from '../league/useTradeIdeas';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import {
  Card,
  colors,
  GhostButton,
  LoadingRows,
  ProLockCard,
  SectionLabel,
} from '../coach/ui';
import { InsightCard } from './InsightCard';

export function InsightsTrades() {
  const { team } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const router = useRouter();
  const league = useLeague();
  const [requested, setRequested] = useState(false);
  const room = useTradeIdeas(
    league.snapshot,
    team?.players ?? [],
    requested && isPremium,
  );
  const week = useWeekData(team);
  const next = useWeekData(team, 1);
  const local = useMemo(() => {
    if (
      !team?.opponent.length ||
      !week.forms.data ||
      !week.schedule.data ||
      !next.schedule.data
    )
      return [];
    return findTrades({
      mine: team.players,
      theirs: team.opponent,
      slots: team.slots,
      values: valuesOf(week.forms.data.forms),
      startShares: startSharesOf(week.forms.data.forms),
      schedules: [week.schedule.data, next.schedule.data],
      today: week.plan?.today ?? week.monday,
      limit: 3,
    });
  }, [
    team,
    week.forms.data,
    week.schedule.data,
    next.schedule.data,
    week.plan,
    week.monday,
  ]);
  return (
    <View>
      <SectionLabel title="Trade opportunities" />
      {!isPremium ? (
        <ProLockCard
          title="Trades that help both lineups"
          detail="Find swaps that fill real lineup gaps over this week and next."
          onPress={() => openPaywall('trade_finder')}
        />
      ) : league.snapshot ? (
        <TradeIdeasCard
          isPro
          hasPartners={otherMembers(league.snapshot).length > 0}
          state={{
            requested,
            ideas: room.data,
            loading: room.loading,
            error: room.error,
          }}
          onFind={() => setRequested(true)}
          onRetry={room.refresh}
          onUnlock={() => openPaywall('trade_finder')}
          onOpen={(idea, side) =>
            openPlayer(
              idea[side].playerId,
              side === 'give' ? 'roster' : 'opponent',
              'league',
            )
          }
        />
      ) : !team?.opponent.length ? (
        <Card>
          <Text style={{ color: colors.sub, fontSize: 13, lineHeight: 20 }}>
            Add your opponent’s roster, or join a League Room, to compare real
            trade partners.
          </Text>
          <GhostButton
            label="Add opponent roster"
            onPress={() =>
              router.push({
                pathname: '/myteam',
                params: { opponent: '1' },
              } as Href)
            }
          />
          <GhostButton
            label="Open League Room"
            onPress={() => router.push('/league' as Href)}
          />
        </Card>
      ) : week.loading || next.loading ? (
        <LoadingRows count={2} />
      ) : week.error || next.error ? (
        <Card>
          <Text style={{ color: colors.sub }}>Trade inputs didn’t load.</Text>
          <GhostButton
            label="Retry"
            onPress={() => {
              week.refresh();
              next.refresh();
            }}
          />
        </Card>
      ) : local.length ? (
        <View style={{ gap: 10 }}>
          {local.map((idea) => (
            <InsightCard
              key={`${idea.give.playerId}-${idea.get.playerId}`}
              title={`${idea.give.playerName} ↔ ${idea.get.playerName}`}
              detail={`Estimated lineup gain: +${idea.myGain.toFixed(1)} for you, +${idea.theirGain.toFixed(1)} for ${team.opponentName || 'your opponent'}. Based on both rosters over this week and next; uses your league’s slot settings.`}
              icon="swap-horizontal"
              onPress={() =>
                openPlayer(idea.get.playerId, 'opponent', 'league')
              }
            />
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: colors.sub, fontSize: 13, lineHeight: 20 }}>
            No one-for-one swap improves both lineups right now. Check again
            after roster or schedule changes.
          </Text>
        </Card>
      )}
    </View>
  );
}
