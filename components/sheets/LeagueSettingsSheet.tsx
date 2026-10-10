/**
 * Per-team league rules: platform, active lineup slots, and scoring (points per stat, or the
 * categories a category league counts). The planner, coach, and pickups all read these.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CategoryKey, FantasyPlatform, FantasyTeam, LeagueFormat, LineupSlots, ScoringWeights } from '../../types/fantasy';
import { LINEUP_PRESETS, MAX_SLOTS_PER_TYPE, presetFor, totalSlots } from '../../services/fantasy/lineup';
import { SLOT_ORDER } from '../../services/fantasy/positions';
import { DEFAULT_SCORING, scoringPresetFor } from '../../services/fantasy/scoring';
import { isCategoryLeague, YAHOO_DEFAULT_CATEGORIES } from '../../services/fantasy/categories';
import { hostName, sanitizeTeamLink } from '../../services/fantasy/hostLinks';
import {
  DEFAULT_LEAGUE_SIZE,
  MAX_LEAGUE_SIZE,
  MAX_MIN_GOALIE_STARTS,
  MIN_LEAGUE_SIZE,
  PLATFORM_LABEL,
  withLeagueFormat,
} from '../../services/teams';
import { track } from '../../services/analytics/track';
import { useTeams } from '../TeamsProvider';
import { Card, colors, SectionLabel } from '../coach/ui';
import { ScoringSection } from './leagueSettings/ScoringSection';
import { Stepper } from './leagueSettings/Stepper';

const PLATFORMS: FantasyPlatform[] = ['yahoo', 'espn', 'fantrax', 'other'];

const SLOT_HELP: Record<string, string> = {
  F: 'Any forward',
  UTIL: 'Any skater',
};

interface LeagueSettingsSheetProps {
  visible: boolean;
  team: FantasyTeam | null;
  onClose: () => void;
}

export default function LeagueSettingsSheet({ visible, team, onClose }: LeagueSettingsSheetProps) {
  const { updateTeam, removeTeam, teams } = useTeams();
  const [name, setName] = useState(team?.name ?? '');
  const [platform, setPlatform] = useState<FantasyPlatform>(team?.platform ?? 'yahoo');
  const [slots, setSlots] = useState<LineupSlots>(team?.slots ?? LINEUP_PRESETS[0].slots);
  const [scoring, setScoring] = useState<ScoringWeights>(team?.scoring ?? DEFAULT_SCORING);
  const [format, setFormat] = useState<LeagueFormat>(isCategoryLeague(team) ? 'categories' : 'points');
  const [categories, setCategories] = useState<CategoryKey[]>(team?.categories ?? YAHOO_DEFAULT_CATEGORIES);
  const [leagueSize, setLeagueSize] = useState<number>(team?.leagueSize ?? DEFAULT_LEAGUE_SIZE);
  const [teamLink, setTeamLink] = useState(team?.teamLink ?? '');
  const [minGoalieStarts, setMinGoalieStarts] = useState<number>(team?.minGoalieStarts ?? 0);

  useEffect(() => {
    if (visible && team) {
      setName(team.name);
      setPlatform(team.platform);
      setSlots(team.slots);
      setScoring(team.scoring);
      setFormat(isCategoryLeague(team) ? 'categories' : 'points');
      setCategories(team.categories ?? YAHOO_DEFAULT_CATEGORIES);
      setLeagueSize(team.leagueSize ?? DEFAULT_LEAGUE_SIZE);
      setTeamLink(team.teamLink ?? '');
      setMinGoalieStarts(team.minGoalieStarts ?? 0);
    }
  }, [visible, team]);

  if (!team) return null;

  const save = () => {
    if (totalSlots(slots) === 0) {
      Alert.alert('Add at least one slot', 'Your lineup needs at least one active slot.');
      return;
    }
    const host = hostName(platform);
    const link = host ? sanitizeTeamLink(teamLink, platform) : undefined;
    if (host && teamLink.trim() && !link) {
      Alert.alert(`That isn’t a ${host} link`, `Paste the address of your team’s page on the ${host} website, or leave it empty.`);
      return;
    }
    if (format !== (isCategoryLeague(team) ? 'categories' : 'points')) track('league_format_set', { format, source: 'settings' });
    updateTeam((current) => {
      const { teamLink: _previous, ...rest } = current;
      const next = {
        ...rest,
        name: name.trim() || current.name,
        platform,
        leagueSize,
        minGoalieStarts,
        slots,
        ...(link ? { teamLink: link } : {}),
        updatedAt: new Date().toISOString(),
      };
      return format === 'categories'
        ? withLeagueFormat(next, 'categories', categories)
        : { ...withLeagueFormat(next, 'points'), scoring };
    }, team.id);
    onClose();
  };

  // A category team's stored weights are derived; switching to points starts from the platform's points.
  const changeFormat = (next: LeagueFormat) => {
    if (next === 'points' && isCategoryLeague(team) && format === 'categories') setScoring(scoringPresetFor(platform));
    setFormat(next);
  };

  const confirmDelete = () => {
    Alert.alert(`Delete ${team.name}?`, 'This removes the team and its roster from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTeam(team.id);
          onClose();
        },
      },
    ]);
  };

  const activePreset = presetFor(slots);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID="league-settings-sheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>League settings</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityRole="button" testID="league-settings-save">
            <Text style={styles.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <SectionLabel title="Team" style={styles.firstLabel} />
          <Card>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Team name"
              placeholderTextColor={colors.muted}
              style={styles.nameInput}
              maxLength={40}
              testID="league-name-input"
            />
            <View style={styles.platforms}>
              {PLATFORMS.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setPlatform(value)}
                  style={[styles.platform, platform === value && styles.platformOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: platform === value }}
                  testID={`platform-${value}`}
                >
                  <Text style={[styles.platformText, platform === value && styles.platformTextOn]}>{PLATFORM_LABEL[value]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.row, styles.sizeRow]}>
              <View>
                <Text style={styles.rowLabel}>Teams in league</Text>
                <Text style={styles.rowHelp}>Sizes the “likely rostered” pickup filter</Text>
              </View>
              <Stepper value={leagueSize} min={MIN_LEAGUE_SIZE} max={MAX_LEAGUE_SIZE} onChange={setLeagueSize} testID="league-size" />
            </View>
            {hostName(platform) ? (
              <View style={styles.linkBlock}>
                <Text style={styles.rowLabel}>Team page link</Text>
                <Text style={styles.rowHelp}>
                  Optional. Paste your team’s page from the {hostName(platform)} website, and “Make these moves” on Tonight opens it.
                </Text>
                <TextInput
                  value={teamLink}
                  onChangeText={setTeamLink}
                  placeholder="https://…"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.linkInput}
                  testID="league-team-link"
                />
              </View>
            ) : null}
          </Card>

          <SectionLabel title="Active lineup slots" />
          <View style={styles.presets}>
            {LINEUP_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => setSlots(preset.slots)}
                style={[styles.preset, activePreset?.id === preset.id && styles.presetOn]}
                testID={`preset-${preset.id}`}
              >
                <Text style={styles.presetLabel}>{preset.label}</Text>
                <Text style={styles.presetDetail}>{preset.detail}</Text>
              </Pressable>
            ))}
          </View>
          <Card>
            {SLOT_ORDER.map((key) => (
              <View key={key} style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>{key}</Text>
                  {SLOT_HELP[key] ? <Text style={styles.rowHelp}>{SLOT_HELP[key]}</Text> : null}
                </View>
                <Stepper
                  value={slots[key]}
                  max={MAX_SLOTS_PER_TYPE}
                  onChange={(value) => setSlots((prev) => ({ ...prev, [key]: value }))}
                  testID={`slot-${key}`}
                />
              </View>
            ))}
            <View style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>Min goalie starts / week</Text>
                <Text style={styles.rowHelp}>{minGoalieStarts === 0 ? 'Off' : 'Head-to-head minimum (Yahoo default: 3)'}</Text>
              </View>
              <Stepper value={minGoalieStarts} max={MAX_MIN_GOALIE_STARTS} onChange={setMinGoalieStarts} testID="min-goalie-starts" />
            </View>
            <Text style={styles.footnote}>Bench and IR slots don’t matter here — only the slots that score.</Text>
          </Card>

          <ScoringSection
            platform={platform}
            format={format}
            onFormat={changeFormat}
            categories={categories}
            onCategories={setCategories}
            scoring={scoring}
            onScoring={setScoring}
          />

          {teams.length > 1 ? (
            <Pressable onPress={confirmDelete} style={styles.delete} testID="league-delete">
              <Text style={styles.deleteText}>Delete this team</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  cancel: {
    fontSize: 16,
    color: colors.sub,
  },
  save: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  firstLabel: {
    marginTop: 12,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -0.5,
    color: colors.text,
    paddingVertical: 4,
  },
  platforms: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  platform: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.raised,
    alignItems: 'center',
  },
  platformOn: {
    backgroundColor: colors.ink,
  },
  platformText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sub,
  },
  platformTextOn: {
    color: colors.onInk,
  },
  linkBlock: {
    gap: 4,
    paddingTop: 8,
  },
  linkInput: {
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.raised,
  },
  sizeRow: {
    marginTop: 8,
  },
  presets: {
    gap: 8,
    marginBottom: 10,
  },
  preset: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  presetOn: {
    borderColor: colors.ink,
    borderWidth: 2,
    padding: 11,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  presetDetail: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowHelp: {
    fontSize: 11,
    color: colors.muted,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 4,
  },
  delete: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.bad,
  },
});
