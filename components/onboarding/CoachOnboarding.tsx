/**
 * First run: what PuckIQ does → your league's rules → your players (RosterStep).
 * No account required. Lock reminders are offered later on Tonight, once the first call shows.
 */

import { styles } from './styles';
import React, { useEffect, useState } from 'react';
import {
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
import type { FantasyPlatform, LeagueFormat, LineupSlots } from '../../types/fantasy';
import { LINEUP_PRESETS, presetFor, slotsPresetFor } from '../../services/fantasy/lineup';
import { DEFAULT_SCORING, sameScoring, scoringPresetFor } from '../../services/fantasy/scoring';
import { categoriesLabel, isCategoryLeague, YAHOO_DEFAULT_CATEGORIES } from '../../services/fantasy/categories';
import { PLATFORM_LABEL, withLeagueFormat } from '../../services/teams';
import { SAMPLE_PLAYERS } from '../../constants/sampleTeam';
import { useTeams } from '../TeamsProvider';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { BrandMark, colors, PrimaryButton } from '../coach/ui';
import { LeagueFormatPicker } from '../leagueFormat/LeagueFormatPicker';
import { RosterStep, type RosterChoice } from './RosterStep';
import { useQuickPicks } from '../../hooks/useQuickPicks';
import { track } from '../../services/analytics/track';

interface CoachOnboardingProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'league' | 'roster';
const STEPS: Step[] = ['welcome', 'league', 'roster'];
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
  // Start loading the face grid on the welcome screen: a cold first load takes several
  // seconds of NHL bios lookups, which should be done by the time the roster step opens.
  const picks = useQuickPicks(team, true);
  const [step, setStep] = useState<Step>('welcome');
  const [platform, setPlatform] = useState<FantasyPlatform>(team?.platform ?? 'yahoo');
  const [slots, setSlots] = useState<LineupSlots>(team?.slots ?? slotsPresetFor(team?.platform ?? 'yahoo'));
  const [format, setFormat] = useState<LeagueFormat>(isCategoryLeague(team) ? 'categories' : 'points');
  const [name, setName] = useState(team?.name && team.name !== 'My Team' ? team.name : '');
  useEffect(() => {
    track('onboarding_step', { step });
  }, [step]);

  // Setup ends on the roster: reminders are asked on Tonight once the first lineup call is showing.
  const finish = (choice: RosterChoice, players: number) => {
    track('onboarding_roster_choice', { choice, players, sample_team: choice === 'sample' });
    track('onboarding_complete', { players, sample_team: choice === 'sample' });
    onComplete();
  };
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

      {step === 'roster' ? <RosterStep picks={picks} bottomInset={insets.bottom} onDone={finish} /> : null}
    </KeyboardAvoidingView>
  );
}
