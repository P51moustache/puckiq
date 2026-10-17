/**
 * Opening a URL or the iOS Settings app can fail (restricted device, App Review sandbox, no
 * handler). These helpers never reject: they fall back to an in-app browser for web links, then to
 * a short alert that tells the person where to go. Device APIs are passed in so tests stay pure.
 */

export type WebLinkResult = 'opened' | 'in_app_browser' | 'alerted';
export type SettingsResult = 'opened' | 'alerted';

export interface WebLinkDeps {
  openUrl: (url: string) => Promise<unknown>;
  openInAppBrowser: (url: string) => Promise<unknown>;
  alert: (title: string, message: string) => void;
}

export interface SettingsDeps {
  openSettings: () => Promise<unknown>;
  alert: (title: string, message: string) => void;
}

export const LINK_FAILED_TITLE = "Couldn't open link";
export const SETTINGS_FAILED_TITLE = "Couldn't open Settings";
export const SETTINGS_FAILED_MESSAGE = 'Open the Settings app, scroll down to PuckIQ, then tap Notifications.';

const WEB_URL = /^https?:\/\//i;
const MAILTO = /^mailto:([^?]+)/i;

/** What to tell the person to do by hand: email the address, or visit the page. */
function manualStep(url: string): string {
  const email = MAILTO.exec(url)?.[1];
  return email ? `Email ${email} from your mail app.` : `Visit ${url} in your browser.`;
}

/** Opens a link in the system handler; web links fall back to an in-app browser, then an alert with the URL. */
export async function openWebLink(url: string, deps: WebLinkDeps): Promise<WebLinkResult> {
  try {
    await deps.openUrl(url);
    return 'opened';
  } catch {
    // fall through to the in-app browser
  }
  if (WEB_URL.test(url)) {
    try {
      await deps.openInAppBrowser(url);
      return 'in_app_browser';
    } catch {
      // fall through to the alert
    }
  }
  deps.alert(LINK_FAILED_TITLE, manualStep(url));
  return 'alerted';
}

/** Opens PuckIQ's page in iOS Settings, or explains how to get there when iOS refuses. */
export async function openAppSettings(deps: SettingsDeps): Promise<SettingsResult> {
  try {
    await deps.openSettings();
    return 'opened';
  } catch {
    deps.alert(SETTINGS_FAILED_TITLE, SETTINGS_FAILED_MESSAGE);
    return 'alerted';
  }
}
