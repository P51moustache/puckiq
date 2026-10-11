import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { colors } from '../../components/coach/ui';
import { SettingsLauncherProvider } from '../../components/SettingsLauncherProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Keep breathing room at the bottom without the oversized default tab inset.
const MAX_TAB_BOTTOM_INSET = 12;

/** Player decisions lead; specialized tools remain reachable through More. */
export const unstable_settings = {
  initialRouteName: 'index',
};

type SymbolName = Parameters<typeof IconSymbol>[0]['name'];

function tabIcon(name: SymbolName) {
  const TabIcon = ({ color }: { color: string; focused: boolean }) => (
    <View style={{ alignItems: 'center' }}>
      <IconSymbol size={21} name={name} color={color} />
    </View>
  );
  return TabIcon;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <SettingsLauncherProvider>
      <Tabs
        safeAreaInsets={
          Platform.OS === 'ios'
            ? { bottom: Math.min(insets.bottom, MAX_TAB_BOTTOM_INSET) }
            : undefined
        }
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
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
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarAccessibilityLabel: 'Home, tab, 1 of 5',
            tabBarButtonTestID: 'tab-home',
            tabBarIcon: tabIcon('house.fill'),
          }}
        />
        <Tabs.Screen
          name="myteam"
          options={{
            title: 'Players',
            tabBarAccessibilityLabel: 'Players, tab, 2 of 5',
            tabBarButtonTestID: 'tab-players',
            tabBarIcon: tabIcon('person.crop.circle.fill'),
          }}
        />
        <Tabs.Screen
          name="lineup"
          options={{
            title: 'Lineup',
            tabBarAccessibilityLabel: 'Lineup, tab, 3 of 5',
            tabBarButtonTestID: 'tab-lineup',
            tabBarIcon: tabIcon('person.2.fill'),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarAccessibilityLabel: 'Insights, tab, 4 of 5',
            tabBarButtonTestID: 'tab-insights',
            tabBarIcon: tabIcon('chart.bar.fill'),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarAccessibilityLabel: 'More, tab, 5 of 5',
            tabBarButtonTestID: 'tab-more',
            tabBarIcon: tabIcon('ellipsis'),
          }}
        />
        <Tabs.Screen name="week" options={{ href: null }} />
        <Tabs.Screen name="pickups" options={{ href: null }} />
        <Tabs.Screen name="league" options={{ href: null }} />
      </Tabs>
    </SettingsLauncherProvider>
  );
}
