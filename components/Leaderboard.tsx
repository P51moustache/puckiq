import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAuthContext } from './auth/AuthProvider';
import { getTopPredictors, setDisplayName, LeaderboardEntry } from '../services/leaderboard';

type Period = 'week' | 'season';

const MEDAL_COLORS: Record<number, string> = {
  1: '#FFD700', // gold
  2: '#C0C0C0', // silver
  3: '#CD7F32', // bronze
};

export default function Leaderboard() {
  const { user } = useAuthContext();
  const [period, setPeriod] = useState<Period>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const data = await getTopPredictors(period);
    setEntries(data);
    setLoading(false);

    // Show name prompt if user is logged in but not on the leaderboard
    if (user && data.length > 0) {
      const isOnBoard = data.some((e) => e.userId === user.id);
      if (!isOnBoard) {
        setShowNamePrompt(true);
      }
    }
  }, [period, user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSetName = useCallback(async () => {
    if (!user || !nameInput.trim()) return;
    await setDisplayName(user.id, nameInput);
    setShowNamePrompt(false);
    setNameInput('');
    fetchLeaderboard();
  }, [user, nameInput, fetchLeaderboard]);

  const formatAccuracy = (accuracy: number) => `${(accuracy * 100).toFixed(1)}%`;

  return (
    <View style={styles.container} testID="leaderboard-container">
      {/* Header */}
      <Text style={styles.title}>Top Predictors</Text>

      {/* Period Toggle */}
      <View style={styles.periodToggle} testID="period-toggle">
        <Pressable
          style={[styles.periodButton, period === 'week' && styles.periodActive]}
          onPress={() => setPeriod('week')}
          testID="period-week"
        >
          <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>
            This Week
          </Text>
        </Pressable>
        <Pressable
          style={[styles.periodButton, period === 'season' && styles.periodActive]}
          onPress={() => setPeriod('season')}
          testID="period-season"
        >
          <Text style={[styles.periodText, period === 'season' && styles.periodTextActive]}>
            All Season
          </Text>
        </Pressable>
      </View>

      {/* Display Name Prompt */}
      {showNamePrompt && (
        <View style={styles.namePrompt} testID="name-prompt">
          <Text style={styles.namePromptText}>Set a display name to join the leaderboard</Text>
          <View style={styles.nameInputRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your display name"
              placeholderTextColor={theme.subtext}
              testID="name-input"
            />
            <Pressable style={styles.nameSubmitButton} onPress={handleSetName} testID="name-submit">
              <Text style={styles.nameSubmitText}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer} testID="leaderboard-loading">
          <ActivityIndicator color={theme.accent} />
        </View>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <View style={styles.emptyContainer} testID="leaderboard-empty">
          <Text style={styles.emptyText}>Be the first on the leaderboard!</Text>
        </View>
      )}

      {/* Leaderboard List */}
      {!loading && entries.length > 0 && (
        <View testID="leaderboard-list">
          {entries.map((entry) => {
            const isCurrentUser = user?.id === entry.userId;
            const medalColor = MEDAL_COLORS[entry.rank];

            return (
              <View
                key={entry.userId}
                style={[styles.row, isCurrentUser && styles.currentUserRow]}
                testID={`leaderboard-row-${entry.rank}`}
              >
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankText, medalColor ? { color: medalColor } : undefined]}>
                    {entry.rank}
                  </Text>
                </View>
                <View style={styles.nameContainer}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {entry.displayName}
                  </Text>
                </View>
                <View style={styles.statsContainer}>
                  <Text style={styles.accuracyText}>{formatAccuracy(entry.accuracy)}</Text>
                  {entry.streak >= 5 && <Text style={styles.streakText}>{'🔥'}{entry.streak}</Text>}
                  <Text style={styles.picksText}>{entry.totalPicks} picks</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold as '600',
    color: theme.text,
    marginBottom: theme.spacing.sm,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: theme.subtle,
    borderRadius: 10,
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodActive: {
    backgroundColor: theme.card,
  },
  periodText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.subtext,
    fontWeight: theme.typography.weights.medium as '500',
  },
  periodTextActive: {
    color: theme.accent,
    fontWeight: theme.typography.weights.semibold as '600',
  },
  namePrompt: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  namePromptText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.text,
    marginBottom: theme.spacing.sm,
  },
  nameInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  nameInput: {
    flex: 1,
    backgroundColor: theme.subtle,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: theme.text,
    fontSize: theme.typography.sizes.sm,
  },
  nameSubmitButton: {
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  nameSubmitText: {
    color: '#fff',
    fontWeight: theme.typography.weights.semibold as '600',
    fontSize: theme.typography.sizes.sm,
  },
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.subtext,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 6,
  },
  currentUserRow: {
    borderWidth: 1,
    borderColor: theme.accent,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold as '700',
    color: theme.text,
  },
  nameContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  displayName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium as '500',
    color: theme.text,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accuracyText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold as '600',
    color: theme.accent,
  },
  streakText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.text,
  },
  picksText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.subtext,
  },
});
