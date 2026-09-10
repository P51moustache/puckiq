import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { arenaType } from "../../constants/arenaTypography";

/** Keep Teko's full native line boxes; tighten only the empty space between them. */
export function ArenaHeadline({
  text,
  fontSize,
  color,
  style,
  textShadowColor,
}: {
  text: string;
  fontSize: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  textShadowColor?: string;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={text.replace(/\n/g, " ")}
      style={style}
    >
      {text.split("\n").map((line, index) => (
        <Text
          key={index}
          accessible={false}
          style={{
            fontFamily: arenaType.display,
            fontSize,
            color,
            // Teko's native ascent + descent is 1.433em. A ~1em lineHeight
            // clips its cap tops on iOS. These margins leave each line intact.
            marginTop: -fontSize * fontScale * 0.2,
            marginBottom: -fontSize * fontScale * 0.15,
            ...(textShadowColor
              ? {
                  textShadowColor,
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 1,
                }
              : {}),
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}
