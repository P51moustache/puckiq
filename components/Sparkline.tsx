import React from 'react';
import { View, StyleSheet } from 'react-native';
import { rinkGlass } from '../constants/theme';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 60,
  height = 24,
  color = rinkGlass.blueLight,
}: SparklineProps) {
  const max = Math.max(...data, 0);
  const barWidth = data.length > 0 ? Math.max((width - (data.length - 1) * 2) / data.length, 2) : 0;

  return (
    <View
      testID="sparkline-container"
      style={[styles.container, { width, height }]}
    >
      {data.map((value, index) => {
        const barHeight = max > 0 ? (value / max) * height : 1;
        return (
          <View
            key={index}
            testID="sparkline-bar"
            style={{
              width: barWidth,
              height: barHeight || 1,
              backgroundColor: color,
              borderRadius: 1,
              marginLeft: index > 0 ? 2 : 0,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
