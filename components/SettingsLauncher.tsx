/**
 * Settings lives behind a gear in every page header instead of taking a tab. The tab layout
 * provides how to open it (SettingsLauncherProvider); anywhere without a provider
 * (onboarding, tests) shows no gear. No router import here, so headers stay light to test.
 */

import { createContext, useContext } from 'react';

export const SettingsLauncherContext = createContext<(() => void) | null>(null);

/** Opens Settings, or null when there's no launcher in scope. */
export function useOpenSettings(): (() => void) | null {
  return useContext(SettingsLauncherContext);
}
