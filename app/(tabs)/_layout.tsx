import { Tabs } from 'expo-router';
import React from 'react';
import { View, type ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '../../components/HapticTab';
import { useArena } from '../../components/arena/ArenaProvider';

export const unstable_settings = { initialRouteName: 'index' };

export default function TabLayout() {
  const { palette: p } = useArena();
  const icon = (name: React.ComponentProps<typeof Ionicons>['name']) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <View style={{ minWidth: 48, alignItems: 'center', paddingVertical: 4, borderRadius: 9, backgroundColor: focused ? p.soft : 'transparent' }}><Ionicons name={name} size={23} color={color} /></View>;
  };
  return <Tabs screenOptions={{ headerShown: false, tabBarButton: HapticTab, tabBarActiveTintColor: p.link, tabBarInactiveTintColor: p.muted, tabBarLabelStyle: { fontFamily: 'Arena-Sans', fontSize: 10, fontWeight: '700' }, tabBarStyle: { backgroundColor: p.paper, borderTopColor: p.edge, borderTopWidth: 1.5, paddingTop: 7 } }}>
    <Tabs.Screen name="index" options={{ title: 'Tonight', tabBarIcon: icon('ticket-outline') }} />
    <Tabs.Screen name="following" options={{ title: 'Following', tabBarIcon: icon('flag-outline') }} />
    <Tabs.Screen name="players" options={{ title: 'Players', tabBarIcon: icon('people-outline') }} />
    <Tabs.Screen name="stats" options={{ title: 'League', tabBarIcon: icon('podium-outline') }} />
    <Tabs.Screen name="hub" options={{ href: null }} />
    <Tabs.Screen name="myteam" options={{ href: null }} />
    <Tabs.Screen name="models" options={{ href: null }} />
    <Tabs.Screen name="teams" options={{ href: null }} />
  </Tabs>;
}
