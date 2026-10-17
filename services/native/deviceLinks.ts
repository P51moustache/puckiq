/**
 * React Native bindings for safeOpen: the calls screens use for legal links and iOS Settings.
 * Failures are logged as product events (no URL beyond the target name) since they no longer throw.
 */

import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { track } from '../analytics/track';
import { openAppSettings, openWebLink, type SettingsResult, type WebLinkResult } from './safeOpen';

const alert = (title: string, message: string) => Alert.alert(title, message);

/** `target` is a short label for analytics (e.g. 'terms', 'privacy'), never the URL itself. */
export async function openLink(url: string, target: string): Promise<WebLinkResult> {
  const result = await openWebLink(url, {
    openUrl: (u) => Linking.openURL(u),
    openInAppBrowser: (u) => WebBrowser.openBrowserAsync(u),
    alert,
  });
  if (result !== 'opened') track('link_open_fallback', { target, result });
  return result;
}

export async function openDeviceSettings(source: string): Promise<SettingsResult> {
  const result = await openAppSettings({ openSettings: () => Linking.openSettings(), alert });
  if (result !== 'opened') track('settings_open_fallback', { source, result });
  return result;
}
