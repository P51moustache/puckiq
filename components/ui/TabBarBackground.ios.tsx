import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { colors } from "../coach/theme";

export default function TabBarBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
