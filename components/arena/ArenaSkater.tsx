import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Defs, FeColorMatrix, Filter, Image } from "react-native-svg";

/** Fictional, unbranded illustration. Neutral equipment works with every home palette. */
export function ArenaSkater({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      style={style}
      viewBox="0 0 1024 1536"
    >
      <Defs>
        <Filter id="neutral-skater">
          <FeColorMatrix type="saturate" values="0" />
        </Filter>
      </Defs>
      <Image
        href={require("../../assets/arena/skater.png")}
        width="1024"
        height="1536"
        filter="url(#neutral-skater)"
      />
    </Svg>
  );
}
