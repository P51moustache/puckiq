/**
 * Player detail sheet: who he is, the call on his next game, this week's games, season + recent
 * form, similar players (one card leads to the next), game log, and the roster actions that make
 * sense from where it was opened. The sections live in components/player/.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { GameLogRow } from '../../services/nhl/player';
import { usePlayerDetail } from '../../hooks/usePlayerDetail';
import { usePlayerCard } from '../../hooks/usePlayerCard';
import { normalizePosition } from '../../services/fantasy/positions';
import { DEFAULT_SCORING } from '../../services/fantasy/scoring';
import { seasonLabel } from '../../services/nhl/dates';
import { track } from '../../services/analytics/track';
import { teamTile } from '../../constants/teamTiles';
import type { PaywallSource } from '../../constants/monetization';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { useRoomTakenIds } from '../league/LeagueProvider';
import { colors } from '../coach/ui';
import { GameLog, RecentGamesChart } from '../player/GameLog';
import { PlayerActions } from '../player/PlayerActions';
import { PlayerHero, PlayerLoading } from '../player/PlayerHero';
import { PlayerNews } from '../player/PlayerNews';
import { HeadlineStats, RecentForm, SeasonSection } from '../player/PlayerStats';
import { RosterSettings } from '../player/RosterSettings';
import { SimilarPlayers } from '../player/SimilarPlayers';
import { TelemetrySection } from '../player/TelemetrySection';
import { useRosterActions } from '../player/useRosterActions';
import { VerdictCard } from '../player/VerdictCard';
import { WeekStrip } from '../player/WeekStrip';

export type PlayerSheetContext = 'roster' | 'opponent' | 'pickup' | 'browse';

/**
 * Where a card was opened from, for analytics only. `context` decides the card's actions;
 * `source` tells which screen or element led there (Tonight's cards and My Team both open
 * with context 'roster').
 */
export type PlayerOpenSource =
  | 'tonight'
  | 'lineup'
  | 'recap'
  | 'next_up'
  | 'first_night'
  | 'myteam'
  | 'week'
  | 'pickups'
  | 'league'
  | 'similar'
  | 'other';

interface OpenArgs {
  playerId: number;
  context: PlayerSheetContext;
}

interface PlayerSheetContextValue {
  openPlayer: (playerId: number, context?: PlayerSheetContext, source?: PlayerOpenSource) => void;
}

const SheetContext = createContext<PlayerSheetContextValue | undefined>(undefined);

export function PlayerSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenArgs | null>(null);
  const { openPaywall } = usePaywall();
  // iOS can't present the paywall modal over this sheet, so close the sheet first and
  // open the paywall once it has finished dismissing.
  const pendingPaywall = useRef<PaywallSource | null>(null);
  const upsell = useCallback((source: PaywallSource) => {
    if (Platform.OS === 'ios') {
      pendingPaywall.current = source;
      setOpen(null);
    } else {
      setOpen(null);
      openPaywall(source);
    }
  }, [openPaywall]);
  const handleDismiss = useCallback(() => {
    const source = pendingPaywall.current;
    pendingPaywall.current = null;
    if (source) openPaywall(source);
  }, [openPaywall]);
  const openPlayer = useCallback((playerId: number, context: PlayerSheetContext = 'browse', source: PlayerOpenSource = 'other') => {
    track('player_open', { context, source });
    setOpen({ playerId, context });
  }, []);
  const value = useMemo(() => ({ openPlayer }), [openPlayer]);
  return (
    <SheetContext.Provider value={value}>
      {children}
      <Modal
        visible={open !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
        onDismiss={handleDismiss}
      >
        {/* Keyed by player: a card opened from another card starts fresh, scrolled to the top. */}
        {open ? <PlayerSheetBody key={open.playerId} {...open} onClose={() => setOpen(null)} onUpsell={upsell} /> : null}
      </Modal>
    </SheetContext.Provider>
  );
}

export function usePlayerSheet(): PlayerSheetContextValue {
  const value = useContext(SheetContext);
  if (!value) throw new Error('usePlayerSheet must be used within a PlayerSheetProvider');
  return value;
}

const NO_GAMES: GameLogRow[] = [];

function PlayerSheetBody({ playerId, context, onClose, onUpsell }: OpenArgs & { onClose: () => void; onUpsell: (source: PaywallSource) => void }) {
  const { team } = useTeams();
  const { isPremium } = useSubscription();
  const { openPlayer } = usePlayerSheet();
  const takenIds = useRoomTakenIds();
  const scoring = team?.scoring ?? DEFAULT_SCORING;
  const detail = usePlayerDetail(playerId, scoring);

  const profile = detail.data?.profile ?? null;
  const form = detail.data?.form ?? null;
  const goalie = profile ? normalizePosition(profile.position) === 'G' : false;
  const rosterPlayer = team?.players.find((player) => player.playerId === playerId) ?? null;
  const onOpponent = team?.opponent.some((player) => player.playerId === playerId) ?? false;
  const log = detail.data?.log?.games ?? NO_GAMES;
  const logSeason = detail.data?.logIsPrevious && detail.data.log ? seasonLabel(detail.data.log.seasonId) : null;

  const card = usePlayerCard({
    playerId,
    profile,
    form,
    formSettled: detail.formSettled,
    // "His last 5" means this season; last season's log only fills the table.
    log: detail.data?.logIsPrevious ? NO_GAMES : log,
    team,
    isPro: isPremium,
    takenIds,
  });
  const actions = useRosterActions({ playerId, profile, rosterPlayer, isPro: isPremium, onClose, onUpsell });

  return (
    <View style={styles.container} testID="player-sheet">
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {!profile ? (
          <PlayerLoading loading={detail.loading} error={!!detail.error} onRetry={detail.refresh} onClose={onClose} />
        ) : (
          <>
            <PlayerHero profile={profile} rosterPlayer={rosterPlayer} onClose={onClose} />
            <View style={styles.body}>
              <HeadlineStats form={form} goalie={goalie} />
              <VerdictCard verdict={card.verdict} loading={card.verdictLoading} />
              <PlayerActions context={context} onMyRoster={rosterPlayer !== null} onOpponent={onOpponent} hasTeam={!!team} actions={actions} />
              <WeekStrip days={card.week} strength={card.strength} goalie={goalie} />
              <SeasonSection form={form} />
              <TelemetrySection playerId={playerId} goalie={goalie} isPro={isPremium} onUnlock={() => onUpsell('player_edge')} />
              <RecentForm form={form} goalie={goalie} isPro={isPremium} onUnlock={() => onUpsell('player_trends')} />
              <RecentGamesChart log={log} goalie={goalie} scoring={scoring} isPro={isPremium} color={teamTile(profile.team).tile} />
              <SimilarPlayers rows={card.similar} onOpen={(id) => openPlayer(id, 'pickup', 'similar')} />
              <GameLog log={log} goalie={goalie} scoring={scoring} isPro={isPremium} seasonLabel={logSeason} onUnlock={() => onUpsell('player_trends')} />
              <PlayerNews items={detail.data?.news ?? []} />
              {rosterPlayer ? (
                <RosterSettings rosterPlayer={rosterPlayer} onToggleEligible={actions.toggleEligible} onToggleIr={actions.toggleIr} />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollBody: {
    paddingBottom: 48,
  },
  body: {
    paddingHorizontal: 18,
  },
});
