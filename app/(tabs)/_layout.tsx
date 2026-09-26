import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { colors } from '../../components/coach/ui';

/** Tonight is home. */
export const unstable_settings = {
  initialRouteName: 'index',
};

/** F1-style red bar riding the top edge of the active tab. */
const ActiveBar = () => (
  <View style={{
    position: 'absolute',
    top: -8,
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  }} />
);

type SymbolName = Parameters<typeof IconSymbol>[0]['name'];

function tabIcon(name: SymbolName) {
  const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={{ alignItems: 'center' }}>
      {focused && <ActiveBar />}
      <IconSymbol size={24} name={name} color={color} />
    </View>
  );
  return TabIcon;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            borderTopColor: colors.border,
          },
          default: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        }),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Tonight', tabBarIcon: tabIcon('hockey.puck.fill') }} />
      <Tabs.Screen name="week" options={{ title: 'Week', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="pickups" options={{ title: 'Pickups', tabBarIcon: tabIcon('chart.line.uptrend.xyaxis') }} />
      <Tabs.Screen name="myteam" options={{ title: 'Roster', tabBarIcon: tabIcon('person.2.fill') }} />
      <Tabs.Screen name="hub" options={{ title: 'Settings', tabBarIcon: tabIcon('gearshape.fill') }} />
    </Tabs>
  );
}
