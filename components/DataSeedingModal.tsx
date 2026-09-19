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
import { Ionicons } from '@expo/vector-icons';
import { checkReplayAvailability, type ReplayDateRange } from '../services/replayAvailability';
import { useArena } from './arena/ArenaProvider';
import { arenaType } from '../constants/arenaTypography';
import type { ArenaPalette } from '../constants/arenaTheme';

interface DataSeedingModalProps {
  visible: boolean;
  onClose: () => void;
  onSeedingComplete?: () => void;
  range: ReplayDateRange;
}

export default function DataSeedingModal({
  visible,
  onClose,
  onSeedingComplete,
  range,
}: DataSeedingModalProps) {
  const { palette: p } = useArena();
  const styles = React.useMemo(() => createStyles(p), [p]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const [latestGameDate, setLatestGameDate] = useState<string | null>(null);
  const abortRef = useRef(false);
  const requestIdRef = useRef(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsSeeding(false);
      setError(null);
      setIsComplete(false);
      setTotalGames(0);
      setLatestGameDate(null);
      abortRef.current = false;
    }
  }, [visible]);

  // Check if data is available (read-only — data is synced by server)
  const handleCheckData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsSeeding(true);
    setError(null);
    abortRef.current = false;

    try {
      const { available, gameCount, latestGameDate: latest } = await checkReplayAvailability(range);

      if (!abortRef.current && requestId === requestIdRef.current) {
        if (available) {
          setTotalGames(gameCount);
          setLatestGameDate(latest);
          setIsComplete(true);
          onSeedingComplete?.();
        } else {
          setError('No completed regular-season games are available in this replay period. Choose another range or check again later.');
        }
      }
    } catch (err) {
      console.error('[DataSeedingModal] Check error:', err);
      if (!abortRef.current && requestId === requestIdRef.current) {
        setError('Unable to check data status. Please try again later.');
      }
    } finally {
      if (!abortRef.current && requestId === requestIdRef.current) {
        setIsSeeding(false);
      }
    }
  }, [onSeedingComplete, range]);

  // Handle skip/close
  const handleSkip = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current = true;
    setIsSeeding(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: p.paper, borderColor: p.edge }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: p.ink, fontFamily: arenaType.display }]}>
              {isComplete ? 'Replay data available' : 'Check replay data'}
            </Text>
            {!isSeeding && !isComplete && (
              <Pressable accessibilityRole="button" accessibilityLabel="Close replay data check" onPress={handleSkip} style={[styles.closeButton, { backgroundColor: p.soft }]}>
                <Ionicons name="close" size={18} color={p.muted} />
              </Pressable>
            )}
          </View>

          {/* Content */}
          {isComplete ? (
            // Success state
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={28} color="#10b981" />
              </View>
              <Text style={styles.successText}>
                Available records: {totalGames.toLocaleString()}
              </Text>
              <Text style={[styles.successSubtext, { color: p.muted, fontFamily: arenaType.body }]}>
                {latestGameDate ? `Latest game in this period: ${latestGameDate}.` : 'This replay period is available.'}
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: p.action, borderColor: p.frame }]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={[styles.primaryButtonText, { color: p.actionInk, fontFamily: arenaType.body }]}>Continue</Text>
              </Pressable>
            </View>
          ) : isSeeding ? (
            // Seeding in progress
            <View style={styles.content}>
              <ActivityIndicator size="large" color={p.action} />

              <Text style={[styles.progressTitle, { color: p.ink, fontFamily: arenaType.body }]}>Checking this replay period</Text>
              <Text style={[styles.progressText, { color: p.muted, fontFamily: arenaType.body }]}>{range.start} through {range.end}</Text>

              <Pressable
                style={styles.cancelButton}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Cancel replay data check"
              >
                <Text style={[styles.cancelButtonText, { color: p.link }]}>Cancel</Text>
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
                  style={[styles.secondaryButton, { backgroundColor: p.soft }]}
                  onPress={handleSkip}
                  accessibilityRole="button"
                  accessibilityLabel="Close replay data check"
                >
                  <Text style={[styles.secondaryButtonText, { color: p.link }]}>Close</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: p.action, borderColor: p.frame }]}
                  onPress={handleCheckData}
                  accessibilityRole="button"
                >
                  <Text style={[styles.primaryButtonText, { color: p.actionInk }]}>Retry</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Initial state - prompt to seed
            <View style={styles.content}>
              <View style={styles.infoIcon}>
                <Ionicons name="stats-chart" size={24} color="#60a5fa" />
              </View>
              <Text style={[styles.description, { color: p.ink, fontFamily: arenaType.body }]}>
                Check completed regular-season games from {range.start} through {range.end}.
              </Text>
              <Text style={[styles.note, { color: p.muted, fontFamily: arenaType.body }]}>
                This is a read-only availability check. It does not download data.
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.secondaryButton, { backgroundColor: p.soft }]}
                  onPress={handleSkip}
                  accessibilityRole="button"
                  accessibilityLabel="Close replay data check"
                >
                  <Text style={[styles.secondaryButtonText, { color: p.link }]}>Close</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: p.action, borderColor: p.frame }]}
                  onPress={handleCheckData}
                  accessibilityRole="button"
                >
                  <Text style={[styles.primaryButtonText, { color: p.actionInk }]}>Check availability</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: ArenaPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: p.paper,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: p.edge,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: p.ink,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: p.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: p.muted,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: p.soft,
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
    color: p.ink,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: p.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: p.action,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: p.soft,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: p.muted,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: p.ink,
    marginTop: 16,
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: p.soft,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: p.action,
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
    color: p.muted,
  },
  progressStats: {
    fontSize: 14,
    fontWeight: '600',
    color: p.ink,
    marginBottom: 4,
  },
  estimatedTime: {
    fontSize: 12,
    color: p.muted,
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 14,
    color: p.muted,
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
    color: p.muted,
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
