/**
 * React Native bindings for safeOpen: the calls screens use for legal links, fantasy-host links and
 * iOS Settings. Failures are logged as product events (no URL beyond the target name) since they no
 * longer throw.
 */

import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { openHostLink, type HostOpenResult } from '../analytics/openHostLink';
import { track } from '../analytics/track';
import type { HostLink } from '../fantasy/hostLinks';
import { openAppSettings, openWebLink, type SettingsResult, type WebLinkDeps, type WebLinkResult } from './safeOpen';

const alert = (title: string, message: string) => Alert.alert(title, message);

/**
 * Always call through the module objects: `Linking.openURL` reads `this`, so passing it bare
 * throws before iOS sees the URL (the 3.3.0 "Open Yahoo" bug).
 */
const webLinkDeps: WebLinkDeps = {
  openUrl: (url) => Linking.openURL(url),
  openInAppBrowser: (url) => WebBrowser.openBrowserAsync(url),
  alert,
};

/** `target` is a short label for analytics (e.g. 'terms', 'privacy'), never the URL itself. */
export async function openLink(url: string, target: string): Promise<WebLinkResult> {
  const result = await openWebLink(url, webLinkDeps);
  if (result !== 'opened') track('link_open_fallback', { target, result });
  return result;
}

/** "Open Yahoo": the host's app or Safari, else the in-app browser, else an alert; reported as host_open_result. */
export function openFantasyHost(host: HostLink, source: string): Promise<HostOpenResult> {
  return openHostLink(host, source, (url) => openWebLink(url, webLinkDeps), track);
}

export async function openDeviceSettings(source: string): Promise<SettingsResult> {
  const result = await openAppSettings({ openSettings: () => Linking.openSettings(), alert });
  if (result !== 'opened') track('settings_open_fallback', { source, result });
  return result;
}
