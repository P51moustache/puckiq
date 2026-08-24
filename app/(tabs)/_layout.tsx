import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { rinkGlass } from '../../constants/theme';

/** This week's lines is the only home. */
export const unstable_settings = {
  initialRouteName: 'index',
};

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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lines',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="hockey.puck.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="myteam"
        options={{
          title: 'Roster',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="person.2.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol size={24} name="person.crop.circle.fill" color={color} />
              {focused && <GlowDot />}
            </View>
          ),
        }}
      />
      {/* Pick-edge / extra-team / NHL briefing surfaces stay in the repo but off the tab bar. */}
      <Tabs.Screen name="news" options={{ href: null }} />
      <Tabs.Screen name="league" options={{ href: null }} />
      <Tabs.Screen name="players" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="teams" options={{ href: null }} />
    </Tabs>
  );
}
