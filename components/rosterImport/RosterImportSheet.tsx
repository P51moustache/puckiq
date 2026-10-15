/**
 * Roster import: screenshot your roster in Yahoo, ESPN or Fantrax (or paste the names) and add
 * everyone at once — instead of searching 20 players one by one, which is where most new users
 * gave up. Screenshots are read on the phone; nothing is uploaded.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRosterImport } from '../../hooks/useRosterImport';
import { addPlayers } from '../../services/teams';
import { toFantasyPlayer } from '../../services/rosterImport/review';
import { track } from '../../services/analytics/track';
import { useTeams } from '../TeamsProvider';
import { Card, colors, DarkCard, display, GhostButton, IconButton, PrimaryButton } from '../coach/ui';
import { ImportReviewList } from './ImportReviewList';
import { RosterReconcileReview } from './RosterReconcileReview';
import { rosterReviewKey, type RosterProposal } from '../../services/rosterImport/reconcileRoster';

export type RosterImportSource = 'onboarding' | 'roster' | 'tonight' | 'sample';

const STEPS = [
  'Open your team in the Yahoo, ESPN or Fantrax app.',
  'Take a screenshot — two or three if your roster scrolls.',
  'Pick them here. PuckIQ finds the players.',
];

export interface RosterImportSheetProps {
  visible: boolean;
  source: RosterImportSource;
  mode?: 'add' | 'reconcile';
  onClose: () => void;
  /** After adding: every player the import covered, including ones already on the team. */
  onAdded?: (playerIds: number[]) => void;
}

const NO_ROSTER_IDS: ReadonlySet<number> = new Set();

export function RosterImportSheet({ visible, source, mode = 'add', onClose, onAdded }: RosterImportSheetProps) {
  const { team, updateTeam } = useTeams();
  const rosterIds = useMemo(() => new Set((team?.players ?? []).map((player) => player.playerId)), [team]);
  const flow = useRosterImport(visible, mode === 'reconcile' ? NO_ROSTER_IDS : rosterIds, source);
  const [proposal, setProposal] = useState<RosterProposal | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const closeState = useRef({ stage: 'choose', added: false });
  closeState.current.stage = flow.stage.kind;

  useEffect(() => {
    if (!visible) return;
    track('roster_import_open', { source });
    const startedAt = Date.now();
    const visit = closeState.current;
    visit.added = false;
    setPasting(false);
    setText('');
    setProposal(null);
    return () => track('roster_import_close', {
      source, stage: visit.stage, added: visit.added,
      elapsed_ms: Math.max(0, Date.now() - startedAt),
    });
  }, [visible, source, mode]);

  const { stage } = flow;
  const method = stage.kind === 'review' || stage.kind === 'reading' ? stage.method : null;

  const covered = stage.kind === 'review' ? [...flow.selection.map((player) => player.playerId), ...stage.review.alreadyOnTeam] : [];
  // Swapping out the sample team: players found that are already there (sample stars the user
  // really has) count too, so the swap works even when nothing is new.
  const confirmable = source === 'sample' ? covered.length : flow.selection.length;

  const add = () => {
    if (!team || confirmable === 0) return;
    const players = flow.selection.map(toFantasyPlayer);
    closeState.current.added = true;
    if (players.length > 0) updateTeam((current) => addPlayers(current, players));
    track('roster_import_add', { source, method, added: players.length });
    onAdded?.(covered);
    onClose();
  };

  const reviewChanges = () => {
    if (!team || stage.kind !== 'review' || !flow.selection.length) return;
    const unresolved = stage.review.match.unmatched.length + stage.review.match.ambiguous.filter((entry, index) =>
      !entry.options.some((option) => option.playerId === stage.review.picks[index])).length;
    setProposal({ teamId: team.id, baseRosterKey: rosterReviewKey(team), selected: flow.selection,
      method: stage.method, unresolved });
  };

  const startOver = () => {
    setPasting(false);
    setProposal(null);
    flow.restart();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID="roster-import-sheet">
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{mode === 'reconcile' ? 'Update your roster' : 'Import your roster'}</Text>
          <IconButton icon="close" label="Close" onPress={onClose} testID="roster-import-close" />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {stage.kind === 'choose' && !pasting ? (
            <>
              <DarkCard texture style={styles.hero}>
                <Text style={styles.heroTitle}>{mode === 'reconcile' ? 'UPDATE FROM YOUR LEAGUE' : 'YOUR WHOLE ROSTER, IN SECONDS'}</Text>
                <Text style={styles.heroBody}>{mode === 'reconcile' ? 'Bring a current roster screenshot or name list. Review additions and departures before applying changes.' : 'No searching player by player. PuckIQ reads the names on your phone — nothing is uploaded.'}</Text>
              </DarkCard>
              <Card style={styles.steps}>
                {STEPS.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepBadge}><Text style={styles.stepNumber}>{index + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {stage.kind === 'choose' && pasting ? (
            <>
              <Text style={styles.lede}>Paste your roster from the web, or type the names. Commas or one per line.</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                autoCorrect={false}
                placeholder={'McDavid, Draisaitl, Hyman\nQuinn Hughes\nShesterkin'}
                placeholderTextColor={colors.muted}
                style={styles.input}
                testID="roster-import-text"
              />
            </>
          ) : null}

          {stage.kind === 'reading' ? (
            <View style={styles.reading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.readingText}>{stage.method === 'screenshot' ? 'Reading your screenshots…' : 'Finding your players…'}</Text>
            </View>
          ) : null}

          {stage.kind === 'review' && proposal && team ? (
            <RosterReconcileReview team={team} proposal={proposal} onUpdate={updateTeam} onBack={() => setProposal(null)}
              onApplied={() => { closeState.current.added = true; onClose(); }} />
          ) : stage.kind === 'review' ? (
            stage.review.match.matched.length + stage.review.match.ambiguous.length > 0 ? (
              <>
                <Text style={styles.found}>
                  FOUND {stage.review.match.matched.length + stage.review.match.ambiguous.length}
                </Text>
                <Text style={styles.lede}>
                  {stage.review.match.matched.some((m) => m.confidence === 'likely')
                    ? 'Untick anyone who isn’t yours. Players marked CHECK were read loosely.'
                    : 'Untick anyone who isn’t yours.'}
                </Text>
                <ImportReviewList review={stage.review} onToggle={flow.toggle} onPick={flow.pick} />
              </>
            ) : (
              <Card style={styles.nothing} testID="roster-import-nothing">
                <Text style={styles.nothingTitle}>No players found</Text>
                <Text style={styles.lede}>
                  {method === 'screenshot'
                    ? 'Use your team’s roster screen (the one with player names), not a stats table or matchup.'
                    : 'Try full names, or last names separated by commas.'}
                </Text>
              </Card>
            )
          ) : null}

          {stage.kind === 'error' ? (
            <Card style={styles.nothing} testID="roster-import-error">
              <Text style={styles.nothingTitle}>That didn’t work</Text>
              <Text style={styles.lede}>{stage.message}</Text>
            </Card>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {stage.kind === 'choose' && !pasting ? (
            <>
              {flow.canScan ? (
                <PrimaryButton label="Choose screenshots" icon="images-outline" onPress={() => void flow.scan()} testID="roster-import-scan" />
              ) : null}
              <GhostButton
                label={flow.canScan ? 'Paste or type names instead' : 'Paste or type names'}
                icon="clipboard-outline"
                tone="neutral"
                onPress={() => setPasting(true)}
                testID="roster-import-paste"
              />
            </>
          ) : null}
          {stage.kind === 'choose' && pasting ? (
            <>
              <PrimaryButton label="Find players" icon="search" onPress={() => void flow.paste(text)} disabled={text.trim().length < 3} testID="roster-import-find" />
              <GhostButton label="Back" tone="neutral" onPress={() => setPasting(false)} />
            </>
          ) : null}
          {stage.kind === 'review' && !proposal ? (
            <>
              <PrimaryButton
                label={mode === 'reconcile' ? 'Review roster changes' : confirmable === 0 ? 'Nothing to add' : `${source === 'sample' ? 'Swap in' : 'Add'} ${confirmable} ${confirmable === 1 ? 'player' : 'players'}`}
                icon="add"
                onPress={mode === 'reconcile' ? reviewChanges : add}
                disabled={confirmable === 0}
                testID="roster-import-add"
              />
              <GhostButton label="Start over" tone="neutral" onPress={startOver} testID="roster-import-restart" />
            </>
          ) : null}
          {stage.kind === 'error' ? <PrimaryButton label="Try again" onPress={startOver} testID="roster-import-retry" /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  title: { ...display(26), textTransform: 'uppercase' },
  body: { paddingHorizontal: 18, paddingBottom: 24, gap: 12 },
  hero: { gap: 10, padding: 18 },
  heroTitle: { ...display(30), color: colors.onInk, lineHeight: 34 },
  heroBody: { fontSize: 15, lineHeight: 21, color: colors.onInkSub },
  steps: { gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  stepNumber: { fontSize: 13, fontWeight: '900', color: colors.onInk },
  stepText: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.text, fontWeight: '600' },
  lede: { fontSize: 14, lineHeight: 20, color: colors.sub },
  input: {
    minHeight: 180,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.card,
    textAlignVertical: 'top',
  },
  reading: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  readingText: { fontSize: 15, fontWeight: '700', color: colors.sub },
  found: { ...display(34) },
  nothing: { gap: 8 },
  nothingTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
