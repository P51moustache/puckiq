import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: 'puckiq_onboarding_complete',
  FANTASY_ROSTER: 'puckiq_fantasy_roster',
  SETUP_NUDGE_DISMISSED: 'puckiq_setup_nudge_dismissed',
};

const MAX_DISMISSALS = 3;

interface FinishSetupCardProps {
  onSetUpNow: () => void;
}

export default function FinishSetupCard({ onSetUpNow }: FinishSetupCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkVisibility();
  }, []);

  async function checkVisibility() {
    try {
      const [onboardingComplete, fantasyRoster, dismissCount] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
        AsyncStorage.getItem(STORAGE_KEYS.FANTASY_ROSTER),
        AsyncStorage.getItem(STORAGE_KEYS.SETUP_NUDGE_DISMISSED),
      ]);

      const dismissed = dismissCount ? parseInt(dismissCount, 10) : 0;

      // Show if: onboarding was completed, but roster was never set up, and not dismissed too many times
      if (onboardingComplete && !fantasyRoster && dismissed < MAX_DISMISSALS) {
        setVisible(true);
      }
    } catch (error) {
      console.error('[FinishSetupCard] Error checking visibility:', error);
    }
  }

  async function handleDismiss() {
    try {
      const current = await AsyncStorage.getItem(STORAGE_KEYS.SETUP_NUDGE_DISMISSED);
      const count = current ? parseInt(current, 10) : 0;
      await AsyncStorage.setItem(STORAGE_KEYS.SETUP_NUDGE_DISMISSED, String(count + 1));
      setVisible(false);
    } catch (error) {
      console.error('[FinishSetupCard] Error dismissing:', error);
    }
  }

  if (!visible) return null;

  return (
    <View style={styles.container} testID="finish-setup-card">
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="construct-outline" size={16} color={rinkGlass.blueLight} />
          </View>
          <Text style={styles.title}>Finish Your Setup</Text>
        </View>
        <Text style={styles.description}>
          Set up your roster for personalized recommendations
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={styles.setupButton}
            onPress={onSetUpNow}
            testID="setup-now-button"
          >
            <Text style={styles.setupButtonText}>Set Up Now</Text>
          </Pressable>
          <Pressable
            onPress={handleDismiss}
            testID="dismiss-nudge-button"
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: rinkGlass.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderLeftWidth: 3,
    borderLeftColor: rinkGlass.blueLight,
  },
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(76, 201, 240, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.display,
  },
  description: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
    marginLeft: 38,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 38,
  },
  setupButton: {
    backgroundColor: rinkGlass.blueLight,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  setupButtonText: {
    color: rinkGlass.ice,
    fontWeight: '700',
    fontSize: 13,
  },
  dismissText: {
    color: rinkGlass.textMuted,
    fontSize: 13,
  },
});
