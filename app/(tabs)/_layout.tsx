import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { rinkGlass } from '../../constants/theme';

/** Force the Upcoming tab as the initial route on every app load */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: rinkGlass.blueLight,
        tabBarInactiveTintColor: rinkGlass.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: rinkGlass.ice,
            borderTopColor: rinkGlass.glassBorder,
          },
          default: {
            backgroundColor: rinkGlass.ice,
            borderTopColor: rinkGlass.glassBorder,
          },
        }),
      }}>
      {/* 5-tab layout: Today, My Team, Players, Explore, Hub */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="hockey.puck.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="myteam"
        options={{
          title: 'My Team',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Players',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Hub',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
        }}
      />
      {/* Hidden screens - loaded by stats.tsx via lazy import, not in tab bar */}
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="teams" options={{ href: null }} />
    </Tabs>
  );
}
