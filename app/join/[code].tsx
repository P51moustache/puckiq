import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import JoinRoomScreen from '../../components/league/JoinRoomScreen';

/** Invite deep link `puckiq://join/ABC234` (also what the web join page's "Open in PuckIQ" opens). */
export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  return <JoinRoomScreen code={Array.isArray(code) ? code[0] ?? '' : code ?? ''} />;
}
