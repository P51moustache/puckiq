import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { barn } from '../../constants/barn';

export default function TabBarBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: barn.ground }]} />;
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
