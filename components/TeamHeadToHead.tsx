/**
 * TeamHeadToHead — pin two teams, see them side-by-side.
 *
 * Top: two pin slots with logo + abbrev + remove (or "+ Pick" placeholder).
 * Below: filter chips + team grid (only when fewer than 2 pinned).
 * When 2 pinned: collapse the picker, show stat rows side-by-side with
 * winner highlight and a horizontal bar showing the magnitude of each gap.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { rinkGlass } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { fetchAllTeams, type SimpleTeam } from '../services/teamList';
import { getTeamComparisonData, formatStatValue, determineWinner } from '../services/teamComparison';
import type { TeamComparisonStats } from '../types/teamStats';

interface TeamHeadToHeadProps {
  /** Optional initial pair from a deep-link / Today row tap. */
  initialA?: string;
  initialB?: string;
}

interface StatRow {
  label: string;
  category: string;
  /** Higher is better unless inverted */
  inverted?: boolean;
  format?: 'number' | 'percentage' | 'decimal';
  decimals?: number;
  homeValue: number;
  awayValue: number;
}

function buildStatRows(home: TeamComparisonStats, away: TeamComparisonStats): { section: string; rows: StatRow[] }[] {
  return [
    {
      section: 'OFFENSE',
      rows: [
        { label: 'Goals / Game', category: 'offense', format: 'decimal', decimals: 2,
          homeValue: home.offense.goalsPerGame, awayValue: away.offense.goalsPerGame },
        { label: 'Shots / Game', category: 'offense', format: 'decimal', decimals: 1,
          homeValue: home.offense.shotsPerGame, awayValue: away.offense.shotsPerGame },
        { label: 'Shooting %', category: 'offense', format: 'percentage', decimals: 1,
          homeValue: home.offense.shootingPct, awayValue: away.offense.shootingPct },
        { label: 'PP %', category: 'offense', format: 'percentage', decimals: 1,
          homeValue: home.offense.powerPlayPct, awayValue: away.offense.powerPlayPct },
      ],
    },
    {
      section: 'DEFENSE',
      rows: [
        { label: 'Goals Against / GP', category: 'defense', format: 'decimal', decimals: 2, inverted: true,
          homeValue: home.defense.goalsAgainstPerGame, awayValue: away.defense.goalsAgainstPerGame },
        { label: 'Shots Against / GP', category: 'defense', format: 'decimal', decimals: 1, inverted: true,
          homeValue: home.defense.shotsAgainstPerGame, awayValue: away.defense.shotsAgainstPerGame },
        { label: 'PK %', category: 'defense', format: 'percentage', decimals: 1,
          homeValue: home.defense.penaltyKillPct, awayValue: away.defense.penaltyKillPct },
      ],
    },
    {
      section: 'GOALTENDING',
      rows: [
        { label: 'Save %', category: 'goaltending', format: 'percentage', decimals: 2,
          homeValue: home.goaltending.savePct, awayValue: away.goaltending.savePct },
        { label: 'GAA', category: 'goaltending', format: 'decimal', decimals: 2, inverted: true,
          homeValue: home.goaltending.goalsAgainstAverage, awayValue: away.goaltending.goalsAgainstAverage },
        { label: 'Shutouts', category: 'goaltending', format: 'number',
          homeValue: home.goaltending.shutouts, awayValue: away.goaltending.shutouts },
      ],
    },
    {
      section: 'DISCIPLINE',
      rows: [
        { label: 'Penalties / Game', category: 'discipline', format: 'decimal', decimals: 2, inverted: true,
          homeValue: home.discipline.penaltiesPerGame, awayValue: away.discipline.penaltiesPerGame },
        { label: 'PIM', category: 'discipline', format: 'number', inverted: true,
          homeValue: home.discipline.penaltyMinutes, awayValue: away.discipline.penaltyMinutes },
      ],
    },
  ];
}

function StatBar({ value, max, color, alignRight }: { value: number; max: number; color: string; alignRight?: boolean }) {
  const pct = Math.min(1, max > 0 ? value / max : 0);
  return (
    <View style={[styles.barTrack, alignRight && { flexDirection: 'row-reverse' }]}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/* ===== PinSlot ===== */
function PinSlot({ team, onClear, side }: { team: SimpleTeam | null; onClear: () => void; side: 'A' | 'B' }) {
  if (!team) {
    return (
      <View style={styles.pinSlotEmpty}>
        <Text style={styles.pinSlotEmptyLabel}>+ PICK TEAM {side}</Text>
      </View>
    );
  }
  return (
    <View style={styles.pinSlotFull}>
      <ExpoImage source={{ uri: getTeamLogoUrl(team.abbrev) }} style={styles.pinLogo} contentFit="contain" />
      <Text style={styles.pinAbbrev}>{team.abbrev}</Text>
      <Pressable onPress={onClear} hitSlop={8} style={styles.pinClear}>
        <Ionicons name="close" size={12} color={rinkGlass.textSecondary} />
      </Pressable>
    </View>
  );
}

export default function TeamHeadToHead({ initialA, initialB }: TeamHeadToHeadProps) {
  const [allTeams, setAllTeams] = useState<SimpleTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinA, setPinA] = useState<SimpleTeam | null>(null);
  const [pinB, setPinB] = useState<SimpleTeam | null>(null);
  const [statsA, setStatsA] = useState<TeamComparisonStats | null>(null);
  const [statsB, setStatsB] = useState<TeamComparisonStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load teams
  useEffect(() => {
    let mounted = true;
    fetchAllTeams()
      .then((teams) => {
        if (!mounted) return;
        setAllTeams(teams);
        if (initialA) {
          const a = teams.find((t) => t.abbrev === initialA);
          if (a) setPinA(a);
        }
        if (initialB) {
          const b = teams.find((t) => t.abbrev === initialB);
          if (b) setPinB(b);
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [initialA, initialB]);

  // Load stats whenever both pinned
  useEffect(() => {
    if (!pinA || !pinB) {
      setStatsA(null);
      setStatsB(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    Promise.all([getTeamComparisonData(pinA.abbrev), getTeamComparisonData(pinB.abbrev)])
      .then(([a, b]) => {
        if (cancelled) return;
        setStatsA(a);
        setStatsB(b);
        setStatsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [pinA, pinB]);

  const onTapTeam = (t: SimpleTeam) => {
    Haptics.selectionAsync().catch(() => {});
    if (!pinA) {
      setPinA(t);
    } else if (!pinB && t.abbrev !== pinA.abbrev) {
      setPinB(t);
    } else if (pinA && pinB) {
      // Replace whichever wasn't just pinned (defaults to B)
      if (t.abbrev !== pinA.abbrev && t.abbrev !== pinB.abbrev) setPinB(t);
    }
  };

  const filteredTeams = useMemo(() => {
    return allTeams.filter((t) => t.abbrev !== pinA?.abbrev && t.abbrev !== pinB?.abbrev);
  }, [allTeams, pinA, pinB]);

  const sections = useMemo(() => {
    if (!statsA || !statsB) return [];
    return buildStatRows(statsA, statsB);
  }, [statsA, statsB]);

  const bothPinned = !!pinA && !!pinB;

  return (
    <View style={styles.container}>
      {/* Pin tray */}
      <View style={styles.pinTrayRow}>
        <PinSlot team={pinA} onClear={() => setPinA(null)} side="A" />
        <Text style={styles.pinTrayVs}>vs</Text>
        <PinSlot team={pinB} onClear={() => setPinB(null)} side="B" />
      </View>

      {!bothPinned && (
        <Text style={styles.explainer}>
          {pinA ? 'Pick one more team to compare.' : 'Pick two teams. Stats line up side-by-side with the winner highlighted.'}
        </Text>
      )}

      {bothPinned ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Two-team header */}
          <View style={styles.h2hHeader}>
            <View style={styles.h2hTeamCol}>
              <ExpoImage source={{ uri: getTeamLogoUrl(pinA.abbrev) }} style={styles.h2hLogo} contentFit="contain" />
              <Text style={styles.h2hAbbrev}>{pinA.abbrev}</Text>
            </View>
            <Text style={styles.h2hAt}>vs</Text>
            <View style={styles.h2hTeamCol}>
              <ExpoImage source={{ uri: getTeamLogoUrl(pinB.abbrev) }} style={styles.h2hLogo} contentFit="contain" />
              <Text style={styles.h2hAbbrev}>{pinB.abbrev}</Text>
            </View>
          </View>

          {statsLoading && (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={rinkGlass.textMuted} />
            </View>
          )}

          {!statsLoading && sections.map((sec) => (
            <View key={sec.section} style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{sec.section}</Text>
                <View style={styles.sectionUnderline} />
              </View>
              {sec.rows.map((row) => {
                const winner = determineWinner(row.homeValue, row.awayValue, !row.inverted);
                const max = Math.max(Math.abs(row.homeValue), Math.abs(row.awayValue), 0.0001);
                const aWin = winner === 'home';
                const bWin = winner === 'away';
                return (
                  <View key={row.label} style={styles.statRow}>
                    <View style={[styles.statValueCol, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.statValue, aWin && styles.statValueWin]}>
                        {formatStatValue(row.homeValue, row.format, row.decimals)}
                      </Text>
                      <StatBar value={Math.abs(row.homeValue)} max={max} color={aWin ? rinkGlass.blueLight : rinkGlass.textMuted} alignRight />
                    </View>
                    <View style={styles.statLabelCol}>
                      <Text style={styles.statLabel}>{row.label}</Text>
                    </View>
                    <View style={styles.statValueCol}>
                      <Text style={[styles.statValue, bWin && styles.statValueWin]}>
                        {formatStatValue(row.awayValue, row.format, row.decimals)}
                      </Text>
                      <StatBar value={Math.abs(row.awayValue)} max={max} color={bWin ? rinkGlass.blueLight : rinkGlass.textMuted} />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={rinkGlass.textMuted} />
            </View>
          ) : (
            <View style={styles.gridWrap}>
              {filteredTeams.map((t) => (
                <Pressable
                  key={t.abbrev}
                  onPress={() => onTapTeam(t)}
                  style={({ pressed }) => [styles.gridCell, pressed && { opacity: 0.7 }]}
                >
                  <ExpoImage source={{ uri: getTeamLogoUrl(t.abbrev) }} style={styles.gridLogo} contentFit="contain" />
                  <Text style={styles.gridAbbrev}>{t.abbrev}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Pin tray
  pinTrayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 6,
  },
  pinTrayVs: {
    fontSize: 12,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pinSlotEmpty: {
    flex: 1,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSlotEmptyLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 1.5,
    fontWeight: '700',
    fontFamily: rinkGlass.fonts.mono,
  },
  pinSlotFull: {
    flex: 1,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.blueLight,
    backgroundColor: 'rgba(76, 201, 240, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  pinLogo: { width: 32, height: 32 },
  pinAbbrev: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },
  pinClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: rinkGlass.zamboni,
    alignItems: 'center',
    justifyContent: 'center',
  },

  explainer: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    paddingHorizontal: 16,
    marginBottom: 10,
    lineHeight: 15,
  },

  // Pick grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 6,
  },
  gridCell: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: rinkGlass.boards,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gridLogo: { width: 32, height: 32 },
  gridAbbrev: {
    fontSize: 10,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },

  // H2H comparison view
  h2hHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  h2hTeamCol: { alignItems: 'center', gap: 6 },
  h2hLogo: { width: 64, height: 64 },
  h2hAbbrev: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 1,
  },
  h2hAt: {
    fontSize: 14,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
  },
  sectionBlock: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionHeaderRow: {
    paddingTop: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    letterSpacing: 1.5,
  },
  sectionUnderline: {
    width: 24,
    height: 2,
    backgroundColor: rinkGlass.blueLight,
    borderRadius: 1,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  statValueCol: {
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textSecondary,
  },
  statValueWin: {
    color: rinkGlass.textPrimary,
  },
  statLabelCol: {
    width: 110,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  barTrack: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: rinkGlass.glassBorder,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 3,
    borderRadius: 1.5,
  },
});
