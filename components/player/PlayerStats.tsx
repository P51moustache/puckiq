/**
 * His numbers on the player card: the headline row (value, games, points or wins), the season
 * line, and last-14-day form (Pro; free users get a lock card).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TREND_LABEL, type PlayerForm } from '../../services/fantasy/form';
import { formatValue } from '../../services/fantasy/scoring';
import type { GoalieLine, SkaterLine } from '../../services/nhl/stats';
import { Card, colors, display, Pill, ProLockCard, SectionLabel, StatCell } from '../coach/ui';
import { sectionStyles } from './styles';

/** Value, games and points (skaters) or value, starts and wins (goalies), big and italic. */
export function HeadlineStats({ form, goalie }: { form: PlayerForm | null; goalie: boolean }) {
  const season = form?.season ?? null;
  return (
    <>
      <View style={styles.bigStats}>
        <View style={styles.bigStat}>
          <Text style={styles.bigValue}>{form ? formatValue(form.value) : '—'}</Text>
          <Text style={styles.bigLabel}>{goalie ? 'VALUE / TEAM GAME' : 'VALUE / GAME'}</Text>
        </View>
        <View style={styles.bigStat}>
          <Text style={styles.bigValue}>{season ? String('gs' in season ? season.gs : season.gp) : '—'}</Text>
          <Text style={styles.bigLabel}>{goalie ? 'STARTS' : 'GP'}</Text>
        </View>
        <View style={styles.bigStat}>
          <Text style={styles.bigValue}>{season ? ('gs' in season ? String(season.wins) : String(season.points)) : '—'}</Text>
          <Text style={styles.bigLabel}>{goalie ? 'WINS' : 'PTS'}</Text>
        </View>
      </View>
      {form?.basis === 'previous' ? <Text style={styles.basisNote}>Last season’s numbers until he plays this season.</Text> : null}
    </>
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
        <StatCell size={22} value={g.savePct ? g.savePct.toFixed(3).replace(/^0/, '') : '—'} label="SV%" />
        <StatCell size={22} value={g.gaa ? g.gaa.toFixed(2) : '—'} label="GAA" />
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
        title={form?.basis === 'previous' && form.season ? 'Last season' : 'Season'}
        right={form ? <Text style={sectionStyles.value}>{formLine(form)}</Text> : null}
      />
      <Card>{form ? <SeasonLine form={form} /> : <Text style={sectionStyles.muted}>No NHL stats yet.</Text>}</Card>
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
      <SectionLabel title="Last 14 days" right={!isPro ? <Pill label="PRO" tone="accent" /> : null} />
      {isPro ? (
        <Card>
          {form && form.recentRate !== null ? (
            <View style={sectionStyles.statRow}>
              <StatCell value={String(form.recentGp)} label={goalie ? 'Starts' : 'Games'} />
              <StatCell value={formatValue(form.recentRate)} label={goalie ? 'Value / start' : 'Value / game'} />
              <StatCell
                value={TREND_LABEL[form.trend]}
                label="Trend"
                tone={form.trend === 'hot' ? 'good' : form.trend === 'cold' ? 'bad' : 'neutral'}
              />
              {goalie ? <StatCell value={`${Math.round(form.startShare * 100)}%`} label="Start share" /> : null}
            </View>
          ) : (
            <Text style={sectionStyles.muted}>No NHL games in the last 14 days.</Text>
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
  bigStats: {
    flexDirection: 'row',
    marginTop: 18,
  },
  bigStat: {
    flex: 1,
  },
  bigValue: {
    ...display(38),
  },
  bigLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  basisNote: {
    fontSize: 12,
    color: colors.warn,
    fontWeight: '700',
    marginTop: 6,
  },
});
