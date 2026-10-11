/**
 * First run: what PuckIQ does → your league's rules → your players → lock reminders.
 * No account required. Permission is only asked if the user taps "Remind me". Players come in
 * by screenshot or pasted names (RosterImportSheet) or one by one through search.
 */

import { styles } from './styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ART } from '../../constants/art';
import type { FantasyPlatform, LeagueFormat, LineupSlots, NhlSearchPlayer } from '../../types/fantasy';
import { LINEUP_PRESETS, presetFor, slotsPresetFor } from '../../services/fantasy/lineup';
import { DEFAULT_SCORING, sameScoring, scoringPresetFor } from '../../services/fantasy/scoring';
import { categoriesLabel, isCategoryLeague, YAHOO_DEFAULT_CATEGORIES } from '../../services/fantasy/categories';
import { positionLabel } from '../../services/fantasy/positions';
import { searchNhlPlayers } from '../../services/nhlPlayerSearch';
import { addPlayers, PLATFORM_LABEL, removePlayer, withLeagueFormat } from '../../services/teams';
import { SAMPLE_PLAYERS, SAMPLE_TEAM_NAME } from '../../constants/sampleTeam';
import { useTeams } from '../TeamsProvider';
import { useReminders } from '../RemindersProvider';
import { toFantasyPlayer } from '../sheets/PlayerSearchSheet';
import { PlayerAvatar, PlayerName, splitName } from '../coach/PlayerAvatar';
import { BrandMark, colors, GhostButton, PrimaryButton } from '../coach/ui';
import { RosterImportSheet } from '../rosterImport/RosterImportSheet';
import { LeagueFormatPicker } from '../leagueFormat/LeagueFormatPicker';
import { track } from '../../services/analytics/track';

interface CoachOnboardingProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'league' | 'roster' | 'reminders';
const STEPS: Step[] = ['welcome', 'league', 'roster', 'reminders'];
const PLATFORMS: FantasyPlatform[] = ['yahoo', 'espn', 'fantrax', 'other'];

const VALUE_PROPS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = [
  { icon: 'moon-outline', title: 'Who plays tonight', body: 'Puck-drop countdowns and NHL scratch checks for your guys only.' },
  { icon: 'grid-outline', title: 'The lineup your slots allow', body: 'Start/sit built on your league’s positions — not just “has a game.”' },
  { icon: 'trending-up-outline', title: 'Pickups for your holes', body: 'Streamers ranked by the empty nights they fill for you.' },
];

const TILE = 64;
const WELCOME_FACES = SAMPLE_PLAYERS.filter((player) => [8478402, 8476453, 8480069, 8478864, 8481559, 8478048, 8480801, 8480800, 8477939, 8479979].includes(player.playerId));

export function CoachOnboarding({ onComplete }: CoachOnboardingProps) {
  const insets = useSafeAreaInsets();
  // The league step is dense; only small phones skip the illustration.
  const roomy = useWindowDimensions().height >= 780;
  const { team, teams, addTeam, updateTeam } = useTeams();
  const reminders = useReminders();
  const [step, setStep] = useState<Step>('welcome');
  const [platform, setPlatform] = useState<FantasyPlatform>(team?.platform ?? 'yahoo');
  const [slots, setSlots] = useState<LineupSlots>(team?.slots ?? slotsPresetFor(team?.platform ?? 'yahoo'));
  const [format, setFormat] = useState<LeagueFormat>(isCategoryLeague(team) ? 'categories' : 'points');
  const [name, setName] = useState(team?.name && team.name !== 'My Team' ? team.name : '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NhlSearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [usedSample, setUsedSample] = useState(false);
  const [importing, setImporting] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    track('onboarding_step', { step });
  }, [step]);

  const finish = (reminders: boolean) => {
    track('onboarding_complete', { players: roster.length, sample_team: usedSample, reminders });
    onComplete();
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchNhlPlayers(trimmed, 15);
        if (id === requestId.current) setResults(found.filter((row) => row.active));
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const roster = useMemo(() => team?.players ?? [], [team]);
  const rosterIds = useMemo(() => new Set(roster.map((player) => player.playerId)), [roster]);

  const finishLeague = () => {
    const teamName = name.trim() || 'My Team';
    track('league_format_set', { format, source: 'onboarding' });
    // A new team starts on its platform's own scoring (Yahoo's defaults) or, in a category league,
    // its default categories — unless the user already set custom scoring in an earlier pass.
    if (teams.length === 0) {
      addTeam({ name: teamName, platform, slots, scoring: scoringPresetFor(platform), format });
    } else {
      updateTeam((current) => {
        const base = { ...current, name: teamName, platform, slots, updatedAt: new Date().toISOString() };
        if (format === 'categories') return withLeagueFormat(base, 'categories');
        if (isCategoryLeague(current)) return withLeagueFormat(base, 'points');
        const untouched = sameScoring(current.scoring, DEFAULT_SCORING) || sameScoring(current.scoring, scoringPresetFor(current.platform));
        return { ...base, format: 'points', scoring: untouched ? scoringPresetFor(platform) : current.scoring };
      });
    }
    setStep('roster');
  };

  const togglePlayer = (result: NhlSearchPlayer) => {
    if (!team) return;
    if (rosterIds.has(result.playerId)) updateTeam((current) => removePlayer(current, result.playerId));
    else updateTeam((current) => addPlayers(current, [toFantasyPlayer(result)]));
  };

  const enableReminders = async () => {
    const granted = await reminders.enable({ source: 'onboarding' });
    finish(granted);
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <KeyboardAvoidingView style={[styles.container, step === 'welcome' && styles.containerInk]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="onboarding">
      {step !== 'welcome' ? (
        <View style={[styles.progress, { paddingTop: insets.top + 12 }]}>
          {STEPS.slice(1).map((value, index) => (
            <View key={value} style={[styles.progressBar, index + 1 <= stepIndex && styles.progressOn]} />
          ))}
        </View>
      ) : null}

      {step === 'welcome' ? (
        <Animated.View entering={FadeIn.duration(400)} style={[styles.welcome, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
          <StatusBar style="light" />
          <View style={styles.welcomeTexture} pointerEvents="none">
            <Image source={ART.hockeyNight} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            <LinearGradient colors={['#0D141A00', colors.bg]} style={styles.welcomeFade} />
          </View>
          <View style={styles.mosaic}>
            {WELCOME_FACES.map((player, index) => (
              <Animated.View
                key={player.playerId}
                entering={FadeInDown.delay(80 + index * 70).duration(420)}
                style={index % 2 === 1 ? styles.mosaicDrop : null}
              >
                <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={TILE} />
              </Animated.View>
            ))}
          </View>
          <View style={styles.welcomeBody}>
            <View style={styles.kickerRow}>
              <BrandMark height={16} />
              <Text style={styles.brand}>PUCKIQ</Text>
            </View>
            <Text style={styles.headline}>{'YOUR FANTASY\nHOCKEY COACH.'}</Text>
            <Text style={styles.lede}>Built around your roster in the Yahoo, ESPN, or Fantrax league you already play.</Text>
            <View style={styles.props}>
              {VALUE_PROPS.map((prop, index) => (
                <Animated.View key={prop.title} entering={FadeInDown.delay(420 + index * 110).duration(400)} style={styles.prop}>
                  <Text style={styles.propNum}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={styles.propText}>
                    <Text style={styles.propTitle}>{prop.title}</Text>
                    <Text style={styles.propBody}>{prop.body}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
          <PrimaryButton label="Set up my team" onPress={() => setStep('league')} testID="onboarding-start" />
          <Text style={[styles.fine, styles.fineOnInk]}>Free to use. No league login — you make the moves in your app.</Text>
        </Animated.View>
      ) : null}

      {step === 'league' ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {roomy ? (
              <Image source={ART.whiteboard} style={styles.whiteboard} contentFit="contain" accessible={false} testID="onboarding-whiteboard" />
            ) : null}
            <Text style={styles.stepTitle}>Your league</Text>
            <Text style={styles.stepLede}>So the lineup math matches your league’s scoring and active slots.</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Team name (optional)"
              placeholderTextColor={colors.muted}
              style={styles.nameInput}
              maxLength={40}
              testID="onboarding-team-name"
            />
            <Text style={styles.label}>PLATFORM</Text>
            <View style={styles.chips}>
              {PLATFORMS.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    // Follow the platform's default lineup unless the user picked another one.
                    const followDefault = presetFor(slots)?.id === presetFor(slotsPresetFor(platform))?.id;
                    setPlatform(value);
                    if (followDefault) setSlots(slotsPresetFor(value));
                  }}
                  style={[styles.chip, platform === value && styles.chipOn]}
                  testID={`onboarding-platform-${value}`}
                >
                  <Text style={[styles.chipText, platform === value && styles.chipTextOn]}>{PLATFORM_LABEL[value]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>HOW YOUR LEAGUE SCORES</Text>
            <LeagueFormatPicker format={format} onChange={setFormat} />
            {format === 'categories' ? (
              <Text style={styles.formatHint} testID="onboarding-categories-hint">
                {platform === 'yahoo' ? 'Yahoo’s default categories' : 'The usual categories'}: {categoriesLabel(YAHOO_DEFAULT_CATEGORIES)}. Change them in League settings.
              </Text>
            ) : null}
            <Text style={styles.label}>ACTIVE LINEUP</Text>
            {LINEUP_PRESETS.map((preset) => {
              const on = preset.slots === slots || JSON.stringify(preset.slots) === JSON.stringify(slots);
              return (
                <Pressable key={preset.id} onPress={() => setSlots(preset.slots)} style={[styles.preset, on && styles.presetOn]} testID={`onboarding-preset-${preset.id}`}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.accent : colors.muted} />
                  <View style={styles.flex}>
                    <Text style={styles.presetLabel}>{preset.label}</Text>
                    <Text style={styles.presetDetail}>{preset.detail}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.fine}>You can fine-tune slots and scoring later in League settings.</Text>
          </ScrollView>
          <PrimaryButton label="Continue" onPress={finishLeague} testID="onboarding-league-continue" />
        </Animated.View>
      ) : null}

      {step === 'roster' ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.page, styles.rosterPage, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.stepTitle}>Add your players</Text>
          <Text style={styles.stepLede}>Everyone on your fantasy roster — bench too. {roster.length > 0 ? `${roster.length} added.` : ''}</Text>
          <Pressable onPress={() => setImporting(true)} style={({ pressed }) => [styles.importCard, pressed && styles.importPressed]} accessibilityRole="button" testID="onboarding-import">
            <View style={styles.importIcon}>
              <Ionicons name="scan-outline" size={20} color={colors.onAccent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.importTitle}>Import from screenshots</Text>
              <Text style={styles.importDetail}>Fastest: your whole Yahoo, ESPN or Fantrax roster at once</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onInkSub} />
          </Pressable>
          <RosterImportSheet visible={importing} source="onboarding" onClose={() => setImporting(false)} />
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search NHL players"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="words"
              testID="onboarding-search"
            />
            {searching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
          {roster.length > 0 && query.trim().length < 2 ? (
            <View style={styles.addedWrap}>
              {roster.map((player) => (
                <Pressable
                  key={player.playerId}
                  onPress={() => updateTeam((current) => removePlayer(current, player.playerId))}
                  style={styles.added}
                  accessibilityLabel={`Remove ${player.playerName}`}
                >
                  <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={22} shape="circle" />
                  <Text style={styles.addedText}>{splitName(player.playerName).last}</Text>
                  <Ionicons name="close" size={12} color={colors.onInkSub} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <FlatList
            style={styles.flex}
            data={results}
            keyExtractor={(item) => String(item.playerId)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const on = rosterIds.has(item.playerId);
              return (
                <Pressable onPress={() => togglePlayer(item)} style={styles.result} testID={`onboarding-result-${item.playerId}`}>
                  <PlayerAvatar playerId={item.playerId} team={item.teamAbbrev} position={item.position} size={44} />
                  <View style={styles.flex}>
                    <PlayerName name={item.name} size={16} />
                    <Text style={styles.resultMeta}>{positionLabel({ position: item.position })} · {item.teamAbbrev || 'No team'}</Text>
                  </View>
                  <Ionicons name={on ? 'checkmark-circle' : 'add-circle'} size={28} color={on ? colors.good : colors.ink} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              query.trim().length >= 2 && !searching ? <Text style={styles.noResults}>No active NHL players match.</Text> : null
            }
          />
          <PrimaryButton
            label={roster.length > 0 ? `Continue with ${roster.length}` : 'Continue'}
            onPress={() => setStep('reminders')}
            disabled={roster.length === 0}
            testID="onboarding-roster-continue"
          />
          {roster.length === 0 ? (
            <Pressable
              onPress={() => {
                // Always named as a sample, so it never passes for the user's own team.
                updateTeam((current) => ({ ...addPlayers(current, SAMPLE_PLAYERS), name: SAMPLE_TEAM_NAME }));
                setUsedSample(true);
                setStep('reminders');
              }}
              style={styles.skip}
              testID="onboarding-sample-team"
            >
              <Text style={styles.sampleText}>Just looking? Try a sample team</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setStep('reminders')} style={styles.skip} testID="onboarding-roster-skip">
            <Text style={styles.skipText}>I’ll add players later</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 'reminders' ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.flex}>
            <Text style={styles.stepTitle}>Never miss lock</Text>
            <Text style={styles.stepLede}>
              An hour before your first puck drop, on nights your lineup needs a change. We name the swaps.
            </Text>
            <View style={styles.lockStage}>
              <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.notice}>
                <View style={styles.noticeIcon}>
                  <Text style={styles.noticeIconText}>P</Text>
                </View>
                <View style={styles.flex}>
                  <View style={styles.noticeHead}>
                    <Text style={styles.noticeApp}>PUCKIQ</Text>
                    <Text style={styles.noticeTime}>6:00 PM</Text>
                  </View>
                  <Text style={styles.noticeTitle}>Lineup change tonight</Text>
                  <Text style={styles.noticeBody}>Start Hyman · bench Kreider. First puck 7:00 PM.</Text>
                </View>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(300).duration(450)} style={styles.lockBar}>
                <View style={styles.lockDot} />
                <Text style={styles.lockLabel}>LINEUP LOCK</Text>
                <Text style={styles.lockValue}>01H : 00M</Text>
              </Animated.View>
            </View>
          </View>
          <PrimaryButton label="Remind me before lock" icon="notifications" onPress={enableReminders} testID="onboarding-reminders-on" />
          <GhostButton label="Not now" onPress={() => finish(false)} tone="neutral" style={styles.notNow} testID="onboarding-finish" />
        </Animated.View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
