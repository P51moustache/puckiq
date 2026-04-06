import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { rinkGlass } from '../../constants/theme';

/** Force the Upcoming tab as the initial route on every app load */
export const unstable_settings = {
  initialRouteName: 'index',
};

/** Small glowing dot rendered beneath the active tab icon */
const GlowDot = () => (
  <View style={{
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: rinkGlass.blueLight,
    marginTop: 3,
    shadowColor: rinkGlass.blueLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  }} />
);

/** Placeholder alert count — will be wired to real data later */
const PLACEHOLDER_ALERT_COUNT = 3;

export default function TabLayout() {
  const alertCount = PLACEHOLDER_ALERT_COUNT;

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
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="hockey.puck.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
          tabBarBadge: alertCount > 0 ? alertCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: rinkGlass.goalLight,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
      <Tabs.Screen
        name="myteam"
        options={{
          title: 'My Team',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="person.2.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Players',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="person.2.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="chart.bar.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Hub',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="person.crop.circle.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      {/* Hidden screens - loaded by stats.tsx via lazy import, not in tab bar */}
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="teams" options={{ href: null }} />
    </Tabs>
  );
}
