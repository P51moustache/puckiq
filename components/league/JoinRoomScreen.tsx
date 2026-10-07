/**
 * Invite landing (`puckiq://join/ABC234`): the code, big; which of my teams joins (a switcher when
 * I have several); sign-in when needed; Join → the League tab.
 */

import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FantasyTeam } from '../../types/fantasy';
import { codeFromLink, isLeagueUnavailable } from '../../services/league';
import { PLATFORM_LABEL } from '../../services/teams';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import { useTeams } from '../TeamsProvider';
import { useAuthContext } from '../auth/AuthProvider';
import { Card, colors, CountdownBar, DarkCard, display, IconButton, LoadingRows, PrimaryButton, SectionLabel } from '../coach/ui';
import { countText } from './format';
import { Kicker } from './Kicker';
import { useLeague } from './LeagueProvider';
import { SignInCard } from './SignInCard';

/** The team an invite joins with unless I pick another: the active one if it's free, else the first free one. */

/** Breathing room above the close button inside the sheet. */
const MODAL_TOP_GAP = 16;
export function defaultJoinTeam(teams: FantasyTeam[], active: FantasyTeam | null): FantasyTeam | null {
  if (active && !active.roomId) return active;
  return teams.find((team) => !team.roomId) ?? active ?? teams[0] ?? null;
}

export default function JoinRoomScreen({ code: raw }: { code: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { teams, team: active, ready } = useTeams();
  const { user, appleSignInReady, signInWithApple } = useAuthContext();
  const league = useLeague();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = codeFromLink(raw);
  const chosen = teams.find((team) => team.id === teamId) ?? defaultJoinTeam(teams, active);
  const unavailable = league.status === 'unavailable';
  const openRoom = league.snapshot;
  const alreadyHere = !!code && !!openRoom && openRoom.room.code === code;
  const blocked = chosen?.roomId
    ? 'This team is already in a League Room. Leave it on the League tab first, or pick another team.'
    : hasSamplePlayers(chosen)
      ? 'Swap the sample roster for your real team first. League-mates would see it.'
      : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const openLeague = () => router.replace('/league' as Href);
  const join = async () => {
    if (!code || !chosen) return;
    setBusy(true);
    setError(null);
    const failed = await league.join(code, { source: 'link', teamId: chosen.id });
    setBusy(false);
    if (!failed) openLeague();
    else if (!isLeagueUnavailable(failed)) setError(failed.message);
  };

  const body = () => {
    if (!code) {
      return (
        <Card style={styles.card} testID="join-invalid">
          <Text style={styles.title}>That invite link doesn’t look right</Text>
          <Text style={styles.text}>Ask for a fresh link, or type the code on the League tab.</Text>
          <PrimaryButton label="Open League" variant="black" onPress={openLeague} testID="join-open-league" />
        </Card>
      );
    }
    if (alreadyHere && openRoom) {
      return (
        <Card style={styles.card} testID="join-already">
          <Text style={styles.title}>You’re already in {openRoom.room.name}</Text>
          <PrimaryButton label="Open League" onPress={openLeague} testID="join-open-league" />
        </Card>
      );
    }
    if (!ready) return <LoadingRows count={2} />;
    if (!user && !unavailable) return <SignInCard ready={appleSignInReady} onSignIn={() => void signInWithApple()} />;
    return (
      <>
        {teams.length > 1 ? (
          <>
            <SectionLabel title="Join with" />
            <View style={styles.pills}>
              {teams.map((team) => {
                const selected = team.id === chosen?.id;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => setTeamId(team.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.pill, selected && styles.pillSelected]}
                    testID={`join-team-${team.id}`}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
                      {team.name}
                      {team.roomId ? ' · in a room' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        <Card style={styles.card} testID="join-team">
          {chosen ? (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {chosen.name}
              </Text>
              <Text style={styles.text}>
                {PLATFORM_LABEL[chosen.platform]} · {countText(chosen.players.length, 'player')}. League-mates see this team’s name and roster, nothing else.
              </Text>
            </>
          ) : null}
          {blocked ? (
            <Text style={styles.blocked} testID="join-blocked">
              {blocked}
            </Text>
          ) : null}
          <PrimaryButton
            label="Join room"
            icon="enter-outline"
            onPress={join}
            loading={busy}
            disabled={unavailable || !chosen || blocked !== null}
            testID="join-submit"
          />
          {error ? (
            <Text style={styles.error} testID="join-error">
              {error}
            </Text>
          ) : null}
        </Card>
      </>
    );
  };

  return (
    <View style={styles.container} testID="join-screen">
      {/* Presented as an iOS modal sheet, which already sits below the status bar. */}
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? MODAL_TOP_GAP : insets.top + 8 }]}>
        <IconButton icon="close" label="Close" onPress={close} testID="join-close" />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DarkCard texture style={styles.hero} testID="join-hero">
          <Kicker dark label="You’re invited · League Room" />
          {code ? <CodeCells code={code} /> : null}
          <Text style={styles.lede}>Join your league’s room on PuckIQ. Every league-mate who joins makes everyone’s coach smarter.</Text>
          {unavailable ? <CountdownBar onDark label="League Rooms are almost here" value="SOON" testID="join-coming-soon" /> : null}
        </DarkCard>
        {body()}
      </ScrollView>
    </View>
  );
}

function CodeCells({ code }: { code: string }) {
  return (
    <View style={styles.cells} accessible accessibilityLabel={`Room code ${code.split('').join(' ')}`} testID="join-code">
      {code.split('').map((char, index) => (
        <View key={index} style={styles.cell}>
          <Text style={styles.cellText}>{char}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  content: { paddingHorizontal: 16, paddingBottom: 60, width: '100%', maxWidth: 600, alignSelf: 'center' },
  hero: { gap: 16 },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, height: 68, borderRadius: 12, backgroundColor: colors.inkRaised, alignItems: 'center', justifyContent: 'center' },
  cellText: { ...display(36), color: colors.onInk },
  lede: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.onInkSub },
  card: { gap: 10, marginTop: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  text: { fontSize: 14, lineHeight: 20, color: colors.sub },
  blocked: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.warn },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.bad, textAlign: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { maxWidth: '100%', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.track },
  pillSelected: { backgroundColor: colors.ink },
  pillText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  pillTextSelected: { color: colors.onInk },
});
