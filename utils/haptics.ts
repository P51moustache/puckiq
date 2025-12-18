import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Centralized haptic feedback utilities for consistent tactile feedback across the app.
 * All functions are safe to call on any platform - they gracefully no-op on web.
 */

const isHapticsSupported = Platform.OS !== 'web';

/**
 * Light impact - for subtle interactions like button taps, toggles
 */
export async function lightImpact(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Silently fail - haptics are not critical
  }
}

/**
 * Medium impact - for confirmations, selections
 */
export async function mediumImpact(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Heavy impact - for significant actions, major completions
 */
export async function heavyImpact(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Success notification - for successful operations like pick confirmed
 */
export async function successNotification(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Warning notification - for warnings or attention needed
 */
export async function warningNotification(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Error notification - for errors or failed operations
 */
export async function errorNotification(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Selection change - for selections in pickers, lists
 */
export async function selectionChanged(): Promise<void> {
  if (!isHapticsSupported) return;
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Silently fail
  }
}
