/**
 * Compact insight panel with the next game, lineup call, and its reasons. The call comes from
 * services/fantasy/playerVerdict; this only renders it.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  PlayerVerdict,
  VerdictTone,
} from "../../services/fantasy/playerVerdict";
import { colors, DarkCard } from "../coach/ui";

/** Kicker dot: green to start, amber to sit or check; otherwise the app's red kicker dot. */
const DOT_COLOR: Record<VerdictTone, string> = {
  good: colors.good,
  warn: colors.warn,
  bad: colors.accent,
  neutral: colors.accent,
};

function Kicker({ label, tone }: { label: string; tone: VerdictTone }) {
  return (
    <View style={styles.kickerRow}>
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[tone] }]} />
      <Text style={styles.kicker} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function VerdictCard({
  verdict,
  loading,
}: {
  verdict: PlayerVerdict | null;
  loading: boolean;
}) {
  if (!verdict) {
    if (!loading) return null;
    return (
      <DarkCard style={styles.card} testID="player-verdict-loading">
        <Kicker label="Next game" tone="neutral" />
        <Text style={styles.waiting}>Reading his week…</Text>
      </DarkCard>
    );
  }
  const spoken = [verdict.when, verdict.call, ...verdict.reasons].join(". ");
  return (
    <DarkCard style={styles.card} testID="player-verdict">
      <View accessible accessibilityLabel={spoken} style={styles.content}>
        <Ionicons name="bulb" size={24} color={colors.accent} />
        <View style={styles.copy}>
          <Text style={styles.insight}>PuckIQ Insight</Text>
          <Text style={styles.reason}>
            <Text style={styles.call} testID={`player-verdict-${verdict.kind}`}>
              {verdict.call}.{" "}
            </Text>
            {verdict.reasons.join(" · ")}
          </Text>
          <Text style={styles.when}>{verdict.when}</Text>
        </View>
      </View>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,37,45,0.32)",
    backgroundColor: "#191115",
    paddingVertical: 7,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: { flex: 1, gap: 3 },
  insight: { fontSize: 13, fontWeight: "600", color: colors.accent },
  when: { fontSize: 10, color: colors.muted },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kicker: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.onInk,
  },
  call: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onInk,
  },
  reason: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400",
    color: colors.onInkSub,
  },
  waiting: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: colors.onInkSub,
  },
});
