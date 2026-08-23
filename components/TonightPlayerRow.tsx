import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rinkGlass } from '../constants/theme';
import { formatLockCountdown } from '../services/lockCountdown';
import { CONFIDENCE_LABEL } from '../services/tonightRoster';
import type { InjurySignal, StartSitRec, TonightPlayerStatus } from '../types/fantasy';

const BADGE: Record<StartSitRec, { color: string; label: string }> = {
  START: { color: rinkGlass.faceoffDot, label: 'START' },
  SIT: { color: rinkGlass.redLine, label: 'SIT' },
  UPSIDE: { color: rinkGlass.powerPlay, label: 'UPSIDE' },
  FLEX: { color: rinkGlass.blueLight, label: 'FLEX' },
};

function formatGameTime(startTimeUTC?: string | null): string {
  if (!startTimeUTC) return '';
  try {
    return new Date(startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function injuryLabel(signal: InjurySignal, note: string | null): string | null {
  if (signal === 'scratch') return note ?? 'Scratch';
  if (signal === 'out') return note ?? 'Out';
  if (signal === 'dtd') return note ?? 'Day-to-day';
  return note;
}

export default function TonightPlayerRow({
  status,
  now,
  testID = 'tonight-player-row',
}: {
  status: TonightPlayerStatus;
  now?: Date;
  testID?: string;
}) {
  const badge = BADGE[status.recommendation] ?? BADGE.FLEX;
  const matchup = status.opponentAbbrev
    ? `${status.isHome ? 'vs' : '@'} ${status.opponentAbbrev}`
    : 'Off tonight';
  const time = formatGameTime(status.startTimeUTC);
  const lock = status.opponentAbbrev
    ? formatLockCountdown(status.startTimeUTC, now, status.gameState)
    : null;
  const context = [matchup, time, lock].filter(Boolean).join(' · ');
  const extra = injuryLabel(status.injurySignal, status.injuryNote);
  const confidence = CONFIDENCE_LABEL[status.confidence] ?? 'Unknown';

  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={[styles.stripe, { backgroundColor: badge.color }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          <Text style={styles.meta}>
            {status.position} · {status.teamAbbrev}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{status.playerName}</Text>
        <Text style={styles.context}>{context}</Text>
        <Text style={styles.reason} numberOfLines={2} testID={`${testID}-confidence`}>
          {[confidence, status.reason, extra].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  meta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 4,
  },
  context: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginBottom: 4,
  },
  reason: {
    fontSize: 12,
    color: rinkGlass.blueLight,
    fontWeight: '500',
  },
});
