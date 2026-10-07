/**
 * League — the League Room for the active team. Before a room: the pitch, then sign in, create
 * or join. In a room: the room itself (`RoomView`). While rooms aren't switched on: the pitch
 * with an "almost here" strip and create / join disabled — calm, never an error.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import { ART } from '../../constants/art';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useAuthContext } from '../auth/AuthProvider';
import TeamSwitcher from '../coach/TeamSwitcher';
import SampleTeamNotice from '../coach/SampleTeamNotice';
import { HowItWorksButton } from '../sheets/HowItWorksSheet';
import { Card, colors, contentFrame, EmptyState, ErrorState, LoadingRows, PrimaryButton } from '../coach/ui';
import { useLeague } from '../league/LeagueProvider';
import { RoomPitch } from '../league/RoomPitch';
import { RoomStart } from '../league/RoomStart';
import { RoomView } from '../league/RoomView';
import { SignInCard } from '../league/SignInCard';

/** Screen-specific facts for the ⓘ sheet (the general League topic lives in HowItWorksSheet). */
export const LEAGUE_HOW_EXTRA = [
  'LEFT on the board is games that count from today through Sunday: lineup slots your players fill, not just games played.',
  'Live points count each team’s best lineup from tonight’s players. PuckIQ can’t see anyone’s real lineup.',
  'Rosters sync when a member opens PuckIQ. One older than two days shows when it was last updated.',
];

const SAMPLE_NOTE = 'Swap the sample roster for your real team first. League-mates would see it.';

export default function LeagueScreen() {
  const router = useRouter();
  const league = useLeague();
  const { team, ready } = useTeams();
  const { appleSignInReady, signInWithApple } = useAuthContext();
  const { status } = league;

  const header = (
    <PageHeader title="League" accessory={<TeamSwitcher />} right={<HowItWorksButton topic="league" extra={LEAGUE_HOW_EXTRA} />} />
  );

  if (!ready || status === 'loading') {
    return (
      <View style={styles.container} testID="league-loading">
        {header}
        <View style={styles.padded}>
          <LoadingRows count={5} />
        </View>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.container} testID="league-no-team">
        {header}
        <EmptyState
          art={ART.emptyRoster}
          title="Build your team first"
          body="A League Room shares your team with your league-mates, so add your roster before you bring it."
          action={<PrimaryButton label="Add players" icon="add" onPress={() => router.push('/myteam' as Href)} testID="league-add-players" />}
        />
      </View>
    );
  }

  if (status === 'ready' && league.snapshot) {
    return (
      <View style={styles.container} testID="league-screen">
        {header}
        <RoomView snapshot={league.snapshot} team={team} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container} testID="league-error">
        {header}
        <ErrorState title="Couldn’t open your room" body={league.error?.message ?? 'Try again in a moment.'} onRetry={() => void league.refresh()} />
      </View>
    );
  }

  // Unavailable, signed out, or no room: the pitch leads.
  const sample = hasSamplePlayers(team);
  return (
    <View style={styles.container} testID={`league-${status.replace('_', '-')}`}>
      {header}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, contentFrame]} showsVerticalScrollIndicator={false}>
        {league.notice ? (
          <Card style={styles.notice} testID="league-notice">
            <Ionicons name="information-circle" size={18} color={colors.warn} />
            <Text style={styles.noticeText}>{league.notice}</Text>
            <Pressable onPress={league.dismissNotice} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </Card>
        ) : null}
        <RoomPitch comingSoon={status === 'unavailable'} />
        {status === 'signed_out' ? (
          <SignInCard ready={appleSignInReady} onSignIn={() => void signInWithApple()} />
        ) : (
          <>
            {status === 'no_room' && sample ? <SampleTeamNotice style={styles.sample} /> : null}
            <RoomStart
              teamName={team.name}
              disabled={status === 'unavailable' || sample}
              note={status === 'no_room' && sample ? SAMPLE_NOTE : null}
              onCreate={league.create}
              onJoin={(code) => league.join(code, { source: 'code' })}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: 16 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 130 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  sample: { marginTop: 12 },
});
