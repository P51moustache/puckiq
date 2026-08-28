import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { barn } from '../../constants/barn';

/** This week's lines is the only home. */
export const unstable_settings = {
  initialRouteName: 'index',
};

const LampTick = ({ on }: { on: boolean }) => (
  <View
    style={{
      width: 22,
      height: 2,
      backgroundColor: on ? barn.signal : 'transparent',
      shadowColor: barn.signal,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: on ? 0.9 : 0,
      shadowRadius: 6,
    }}
  />
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: barn.ink,
        tabBarInactiveTintColor: barn.ghost,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 2,
          fontFamily: barn.fonts.mono,
          textTransform: 'uppercase',
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: barn.ground,
            borderTopColor: barn.rule,
            borderTopWidth: 1,
          },
          default: {
            backgroundColor: barn.ground,
            borderTopColor: barn.rule,
            borderTopWidth: 1,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lines',
          tabBarIcon: ({ focused }) => <LampTick on={focused} />,
        }}
      />
      <Tabs.Screen
        name="myteam"
        options={{
          title: 'Roster',
          tabBarIcon: ({ focused }) => <LampTick on={focused} />,
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <LampTick on={focused} />,
        }}
      />
    </Tabs>
  );
}
