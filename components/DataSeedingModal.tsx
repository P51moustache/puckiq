/**
 * DataSeedingModal Component
 * Shows progress when seeding historical game data for backtesting
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { theme } from '../constants/theme';
import {
  seedSeason,
  getCurrentSeasonId,
  isSeasonSeeded,
  type SeedingProgressCallback,
} from '../services/historicalGames';
import { seedCurrentSeason } from '../services/gameResults';

interface DataSeedingModalProps {
  visible: boolean;
  onClose: () => void;
  onSeedingComplete?: () => void;
}

interface SeedingProgress {
  currentDate: string;
  gamesLoaded: number;
  totalDays: number;
  currentDay: number;
}

export default function DataSeedingModal({
  visible,
  onClose,
  onSeedingComplete,
}: DataSeedingModalProps) {
  const [isSeeding, setIsSeeding] = useState(false);
  const [progress, setProgress] = useState<SeedingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const abortRef = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsSeeding(false);
      setProgress(null);
      setError(null);
      setIsComplete(false);
      setTotalGames(0);
      abortRef.current = false;
    }
  }, [visible]);

  // Calculate estimated time remaining
  const getEstimatedTime = useCallback(() => {
    if (!progress || progress.currentDay === 0) return 'Calculating...';

    const remainingDays = progress.totalDays - progress.currentDay;
    // Estimate ~60ms per day (50ms delay + API time)
    const estimatedSeconds = Math.ceil((remainingDays * 60) / 1000);

    if (estimatedSeconds < 60) {
      return `~${estimatedSeconds}s remaining`;
    } else {
      const minutes = Math.ceil(estimatedSeconds / 60);
      return `~${minutes}m remaining`;
    }
  }, [progress]);

  // Handle starting the seeding process
  const handleStartSeeding = useCallback(async () => {
    setIsSeeding(true);
    setError(null);
    setProgress(null);
    abortRef.current = false;

    const seasonId = getCurrentSeasonId();

    try {
      // Check if already seeded
      const alreadySeeded = await isSeasonSeeded(seasonId);
      if (alreadySeeded) {
        setIsComplete(true);
        setIsSeeding(false);
        onSeedingComplete?.();
        return;
      }

      // Start seeding with progress callback
      const progressCallback: SeedingProgressCallback = (prog) => {
        if (abortRef.current) return;
        setProgress(prog);
      };

      // Seed both stores in parallel:
      // 1. AsyncStorage (for backtesting via historicalGames)
      // 2. Supabase game_results (for momentum, clutch, H2H)
      const [gamesCount] = await Promise.all([
        seedSeason(seasonId, progressCallback),
        seedCurrentSeason(),
      ]);

      if (!abortRef.current) {
        setTotalGames(gamesCount);
        setIsComplete(true);
        onSeedingComplete?.();
      }
    } catch (err) {
      console.error('[DataSeedingModal] Seeding error:', err);
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to seed data');
      }
    } finally {
      if (!abortRef.current) {
        setIsSeeding(false);
      }
    }
  }, [onSeedingComplete]);

  // Handle skip/close
  const handleSkip = useCallback(() => {
    abortRef.current = true;
    setIsSeeding(false);
    onClose();
  }, [onClose]);

  // Calculate progress percentage
  const progressPercentage = progress
    ? Math.round((progress.currentDay / progress.totalDays) * 100)
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isComplete ? 'Data Ready!' : 'Historical Data Required'}
            </Text>
            {!isSeeding && !isComplete && (
              <Pressable onPress={handleSkip} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Content */}
          {isComplete ? (
            // Success state
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.successText}>
                Successfully loaded {totalGames.toLocaleString()} games
              </Text>
              <Text style={styles.successSubtext}>
                You can now run backtests on your models
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={onClose}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          ) : isSeeding ? (
            // Seeding in progress
            <View style={styles.content}>
              <ActivityIndicator size="large" color={theme.accent} />

              <Text style={styles.progressTitle}>Downloading Game Data</Text>

              {progress && (
                <>
                  {/* Progress bar */}
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${progressPercentage}%` },
                      ]}
                    />
                  </View>

                  {/* Progress details */}
                  <View style={styles.progressDetails}>
                    <Text style={styles.progressText}>
                      {progress.currentDate}
                    </Text>
                    <Text style={styles.progressText}>
                      {progressPercentage}%
                    </Text>
                  </View>

                  <Text style={styles.progressStats}>
                    {progress.gamesLoaded.toLocaleString()} games loaded
                  </Text>

                  <Text style={styles.estimatedTime}>
                    {getEstimatedTime()}
                  </Text>
                </>
              )}

              <Pressable
                style={styles.cancelButton}
                onPress={handleSkip}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : error ? (
            // Error state
            <View style={styles.content}>
              <View style={styles.errorIcon}>
                <Text style={styles.errorIconText}>!</Text>
              </View>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleSkip}
                >
                  <Text style={styles.secondaryButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleStartSeeding}
                >
                  <Text style={styles.primaryButtonText}>Retry</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Initial state - prompt to seed
            <View style={styles.content}>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>📊</Text>
              </View>
              <Text style={styles.description}>
                To backtest your models against historical games, we need to
                download game results from this season.
              </Text>
              <Text style={styles.note}>
                This only needs to be done once and takes about 2-3 minutes.
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleSkip}
                >
                  <Text style={styles.secondaryButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleStartSeeding}
                >
                  <Text style={styles.primaryButtonText}>Seed Data</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: theme.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: theme.subtext,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.accent}22`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconText: {
    fontSize: 28,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b98122',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 28,
    color: '#10b981',
    fontWeight: '700',
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef444422',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconText: {
    fontSize: 28,
    color: '#ef4444',
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: theme.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: theme.subtext,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: theme.subtle,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: theme.subtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: theme.subtext,
  },
  progressStats: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  estimatedTime: {
    fontSize: 12,
    color: theme.subtext,
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 14,
    color: theme.subtext,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
});
