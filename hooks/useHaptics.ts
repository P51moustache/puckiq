import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Simple haptic feedback hooks for PuckIQ
// Respects platform — haptics only work on iOS physical devices and some Android

export function useHaptics() {
  const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

  const tap = () => {
    if (!isSupported) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const press = () => {
    if (!isSupported) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const success = () => {
    if (!isSupported) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selection = () => {
    if (!isSupported) return;
    Haptics.selectionAsync();
  };

  return { tap, press, success, selection };
}
