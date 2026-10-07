import React from 'react';
import { useRouter } from 'expo-router';
import SettingsScreen from '../components/screens/SettingsScreen';

/** Settings opens from the gear in every page header (it no longer takes a tab). */
export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onBack={() => router.back()} />;
}
