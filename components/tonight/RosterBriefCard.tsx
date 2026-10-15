import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { RosterBriefItem } from '../../services/engagement/rosterBrief';
import { Card, colors, GhostButton } from '../coach/ui';

export function RosterBriefCard({ items, onOpen, onDismiss }: { items: RosterBriefItem[]; onOpen: (item: RosterBriefItem) => void; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);
  if (!items.length) return null;
  return (
    <Card style={styles.card} testID="roster-brief">
      <Text style={styles.kicker}>SINCE YOUR LAST VISIT</Text>
      {visible.map((item) => (
        <Card key={`${item.kind}-${item.playerId ?? item.slot}`} onPress={() => onOpen(item)} style={styles.item} testID={`brief-${item.kind}`}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
          <Text style={styles.action}>{item.kind === 'slot_gap' ? 'Find one pickup →' : 'Review player →'}</Text>
        </Card>
      ))}
      {items.length > 3 && !expanded ? <GhostButton label={`See ${items.length - 3} more changes`} tone="neutral" onPress={() => setExpanded(true)} testID="brief-expand" /> : null}
      <GhostButton label="Got it" tone="neutral" onPress={onDismiss} testID="brief-dismiss" />
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { gap: 10, marginBottom: 12 },
  item: { borderWidth: 0, padding: 0, gap: 4 },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  detail: { color: colors.sub, fontSize: 13, lineHeight: 19 },
  action: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 3 },
});
