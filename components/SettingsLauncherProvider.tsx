/**
 * Supplies the header gear's action: push the Settings route.
 */

import React, { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { SettingsLauncherContext } from './SettingsLauncher';

export function SettingsLauncherProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const open = useCallback(() => router.push('/settings' as Href), [router]);
  return <SettingsLauncherContext.Provider value={open}>{children}</SettingsLauncherContext.Provider>;
}
