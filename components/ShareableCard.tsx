import { View, Text, TouchableOpacity, Share, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { ConfidenceBadge } from './ConfidenceBadge';

export interface ShareablePickData {
  predictedWinner: string;
  opponent: string;
  confidenceScore: number;
  confidenceLabel: string;
}

export interface ShareableStatData {
  accuracy: number;
  totalPicks: number;
  period: string; // e.g. "this month", "last 7 days"
}

interface ShareableCardProps {
  type: 'pick' | 'stat';
  data: ShareablePickData | ShareableStatData;
  onShare?: () => void;
}

function formatShareText(type: 'pick' | 'stat', data: ShareablePickData | ShareableStatData): string {
  if (type === 'pick') {
    const d = data as ShareablePickData;
    return `[${d.confidenceLabel}] ${d.predictedWinner} over ${d.opponent} — ${d.confidenceScore}% confidence. PuckIQ — Your Edge Before Every Pick`;
  }
  const d = data as ShareableStatData;
  return `My PuckIQ accuracy: ${d.accuracy}% ${d.period} (${d.totalPicks} picks). PuckIQ — Your Edge Before Every Pick`;
}

export function ShareableCard({ type, data, onShare }: ShareableCardProps) {
  const handleShare = async () => {
    try {
      const message = formatShareText(type, data);
      await Share.share({ message });
      onShare?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message !== 'User did not share') {
        Alert.alert('Share failed', 'Could not open share dialog.');
      }
    }
  };

  if (type === 'pick') {
    const d = data as ShareablePickData;
    return (
      <View testID="shareable-card" style={styles.card}>
        <View style={styles.pickContent}>
          <ConfidenceBadge confidence={d.confidenceScore} size="lg" />
          <Text style={styles.pickTeam}>{d.predictedWinner}</Text>
          <Text style={styles.pickVs}>over {d.opponent}</Text>
          <Text style={styles.pickConfidence}>{d.confidenceScore}% confidence</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.branding}>PuckIQ</Text>
          <TouchableOpacity testID="share-button" onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const d = data as ShareableStatData;
  return (
    <View testID="shareable-card" style={styles.card}>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>My Accuracy</Text>
        <Text style={styles.statValue}>{d.accuracy}%</Text>
        <Text style={styles.statPeriod}>{d.period} · {d.totalPicks} picks</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.branding}>PuckIQ</Text>
        <TouchableOpacity testID="share-button" onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Standalone share button for embedding in other cards
 */
export function ShareButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity testID="share-button" onPress={onPress} style={styles.shareButtonInline}>
      <Ionicons name="share-outline" size={18} color={theme.accent} />
    </TouchableOpacity>
  );
}

/**
 * Helper to trigger share for a pick
 */
export async function sharePick(pick: ShareablePickData & { h2hSummary?: string }, onShare?: () => void) {
  try {
    const label = pick.confidenceScore >= 85 ? 'LOCK' : pick.confidenceScore >= 70 ? 'STRONG' : pick.confidenceScore >= 55 ? 'LEAN' : 'TOSS-UP';
    const h2hLine = pick.h2hSummary ? ` | ${pick.h2hSummary}` : '';
    const message = `[${label}] ${pick.predictedWinner} over ${pick.opponent} — ${pick.confidenceScore}% confidence${h2hLine}. PuckIQ — Your Edge Before Every Pick`;
    await Share.share({ message });
    onShare?.();
  } catch {
    // User cancelled
  }
}

/**
 * Helper to trigger share for a stat
 */
export async function shareStat(stat: ShareableStatData, onShare?: () => void) {
  try {
    const message = `My PuckIQ accuracy: ${stat.accuracy}% ${stat.period} (${stat.totalPicks} picks). PuckIQ — Your Edge Before Every Pick`;
    await Share.share({ message });
    onShare?.();
  } catch {
    // User cancelled
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a1628',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.card,
  },
  pickContent: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  pickTeam: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
    marginTop: 4,
  },
  pickVs: {
    fontSize: 16,
    color: theme.subtext,
    fontWeight: '500',
  },
  pickConfidence: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  statContent: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 14,
    color: theme.subtext,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.text,
  },
  statPeriod: {
    fontSize: 14,
    color: theme.subtext,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.card,
    paddingTop: 12,
  },
  branding: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    letterSpacing: 1,
  },
  shareButton: {
    padding: 8,
  },
  shareButtonInline: {
    padding: 6,
  },
});
