import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

interface AnimatedProbabilityBarProps {
  awayProb: number;
  homeProb: number;
  height?: number;
  awayColor?: string;
  homeColor?: string;
  backgroundColor?: string;
}

/**
 * Animated probability bar that shows win probability split between two teams.
 * Animates from 0 to the actual values on mount.
 */
export default function AnimatedProbabilityBar({
  awayProb,
  homeProb,
  height = 8,
  awayColor = '#60a5fa',
  homeColor = '#f59e0b',
  backgroundColor = '#192e5e44',
}: AnimatedProbabilityBarProps) {
  const awayWidth = useRef(new Animated.Value(0)).current;
  const homeWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate bars with a staggered effect
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(awayWidth, {
          toValue: awayProb,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(homeWidth, {
          toValue: homeProb,
          duration: 800,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [awayProb, homeProb, awayWidth, homeWidth]);

  return (
    <View style={{
      height,
      backgroundColor,
      borderRadius: height / 2,
      overflow: 'hidden',
      flexDirection: 'row',
    }}>
      <Animated.View style={{
        width: awayWidth.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%'],
        }),
        backgroundColor: awayColor,
        height: '100%',
      }} />
      <Animated.View style={{
        width: homeWidth.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%'],
        }),
        backgroundColor: homeColor,
        height: '100%',
      }} />
    </View>
  );
}
