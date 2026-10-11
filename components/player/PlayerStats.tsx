/**
 * His numbers on the player card: the headline row (value, games, points or wins), the season
 * line, and last-14-day form (Pro; free users get a lock card).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TREND_LABEL, type PlayerForm } from '../../services/fantasy/form';
import { formatValue } from '../../services/fantasy/scoring';
import type { GoalieLine, SkaterLine } from '../../services/nhl/stats';
import {
  Card,
  colors,
  display,
  Pill,
  ProLockCard,
  SectionLabel,
  StatCell,
} from '../coach/ui';
import { sectionStyles } from './styles';

/** Compact season totals with a consistent skater/goalie layout. */
export function HeadlineStats({
  form,
  goalie,
}: {
  form: PlayerForm | null;
  goalie: boolean;
}) {
  const line = form?.season;
  const skater = line && !('gs' in line) ? line : null;
  const keeper = line && 'gs' in line ? line : null;
  const stats = goalie
    ? [
        ['GS', keeper?.gs],
        ['W', keeper?.wins],
        ['SV%', keeper ? keeper.savePct.toFixed(3).replace(/^0/, '') : null],
        ['GAA', keeper?.gaa.toFixed(2)],
        ['SO', keeper?.shutouts],
      ]
    : [
        ['GP', skater?.gp],
        ['G', skater?.goals],
        ['A', skater?.assists],
        ['PTS', skater?.points],
        [
          'SOG/G',
          skater && skater.gp > 0
            ? (skater.shots / skater.gp).toFixed(1)
            : null,
        ],
      ];
  return (
    <View>
      <Text style={styles.seasonLabel}>
        {form?.basis === 'previous' ? 'Previous season' : 'This season'}
      </Text>
      <View style={styles.bigStats}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.bigStat}>
            <Text style={styles.bigValue}>{value ?? '—'}</Text>
            <Text style={styles.bigLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {form?.basis === 'previous' ? (
        <Text style={styles.basisNote}>
          Last season’s numbers until he plays this season.
        </Text>
      ) : null}
    </View>
  );
}

function formLine(form: PlayerForm): string {
  return `${formatValue(form.seasonRate)} ${form.isGoalie ? 'per start' : 'per game'}`;
}

function SeasonLine({ form }: { form: PlayerForm }) {
  const line = form.season;
  if (!line) return <Text style={sectionStyles.muted}>No NHL games yet.</Text>;
  if ('gs' in line) {
    const g = line as GoalieLine;
    return (
      <View style={sectionStyles.statRow}>
        <StatCell size={22} value={String(g.gs)} label="GS" />
        <StatCell size={22} value={String(g.wins)} label="W" />
        <StatCell
          size={22}
          value={g.savePct ? g.savePct.toFixed(3).replace(/^0/, '') : '—'}
          label="SV%"
        />
        <StatCell
          size={22}
          value={g.gaa ? g.gaa.toFixed(2) : '—'}
          label="GAA"
        />
        <StatCell size={22} value={String(g.shutouts)} label="SO" />
      </View>
    );
  }
  const s = line as SkaterLine;
  return (
    <View style={sectionStyles.statRow}>
      <StatCell size={22} value={String(s.gp)} label="GP" />
      <StatCell size={22} value={String(s.goals)} label="G" />
      <StatCell size={22} value={String(s.assists)} label="A" />
      <StatCell size={22} value={String(s.ppp)} label="PPP" />
      <StatCell size={22} value={String(s.shots)} label="SOG" />
      <StatCell size={22} value={String(s.hits)} label="HIT" />
    </View>
  );
}

/** This season's line (or last season's, before he has played). */
export function SeasonSection({ form }: { form: PlayerForm | null }) {
  return (
    <>
      <SectionLabel
        title={
          form?.basis === 'previous' && form.season ? 'Last season' : 'Season'
        }
        right={
          form ? (
            <Text style={sectionStyles.value}>{formLine(form)}</Text>
          ) : null
        }
      />
      <Card>
        {form ? (
          <SeasonLine form={form} />
        ) : (
          <Text style={sectionStyles.muted}>No NHL stats yet.</Text>
        )}
      </Card>
    </>
  );
}

/** Last-14-day value, trend and goalie start share: Pro. */
export function RecentForm({
  form,
  goalie,
  isPro,
  onUnlock,
}: {
  form: PlayerForm | null;
  goalie: boolean;
  isPro: boolean;
  onUnlock: () => void;
}) {
  return (
    <>
      <SectionLabel
        title="Last 14 days"
        right={!isPro ? <Pill label="PRO" tone="accent" /> : null}
      />
      {isPro ? (
        <Card>
          {form && form.recentRate !== null ? (
            <View style={sectionStyles.statRow}>
              <StatCell
                value={String(form.recentGp)}
                label={goalie ? 'Starts' : 'Games'}
              />
              <StatCell
                value={formatValue(form.recentRate)}
                label={goalie ? 'Value / start' : 'Value / game'}
              />
              <StatCell
                value={TREND_LABEL[form.trend]}
                label="Trend"
                tone={
                  form.trend === 'hot'
                    ? 'good'
                    : form.trend === 'cold'
                      ? 'bad'
                      : 'neutral'
                }
              />
              {goalie ? (
                <StatCell
                  value={`${Math.round(form.startShare * 100)}%`}
                  label="Start share"
                />
              ) : null}
            </View>
          ) : (
            <Text style={sectionStyles.muted}>
              No NHL games in the last 14 days.
            </Text>
          )}
        </Card>
      ) : (
        <ProLockCard
          title="Recent form & trend"
          detail="Last-14-day value, hot/cold trend, and goalie start share."
          onPress={onUnlock}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  seasonLabel: { fontSize: 12, color: colors.text, marginTop: 7 },
  bigStats: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 5,
  },
  bigStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: 6,
    borderRadius: 7,
  },
  bigValue: {
    ...display(19),
  },
  bigLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.sub,
  },
  basisNote: {
    fontSize: 13,
    color: colors.warn,
    fontWeight: '700',
    marginTop: 6,
  },
});
