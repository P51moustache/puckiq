import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';

interface WaiverPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  valueScore: number;
  ownershipPct: number;
  projectedPoints: number;
  currentPlayerName?: string;
  currentPlayerPoints?: number;
}

interface WaiverWireModuleProps {
  players: WaiverPlayer[];
}

function WaiverCard({ player, rank, index }: { player: WaiverPlayer; rank: number; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);

  const hasComparison = player.currentPlayerName != null;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={styles.card}
    >
      <View style={styles.cardRow}>
        {/* Rank badge */}
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>

        {/* Player info */}
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.teamPosition}>{player.team} · {player.position}</Text>
          <Text style={styles.ownership}>{player.ownershipPct}% owned</Text>
        </View>

        {/* Value score */}
        <View style={styles.valueContainer}>
          <Text style={styles.valueScore}>+{player.valueScore}</Text>
        </View>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        {hasComparison && (
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
            style={styles.compareButton}
          >
            <Text style={styles.compareText}>{expanded ? 'Hide' : 'Compare'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID={`add-btn-${player.id}`}
          onPress={() => setAdded(!added)}
          activeOpacity={0.7}
          style={[styles.addButton, added && styles.addButtonActive]}
        >
          {added ? (
            <Ionicons testID={`added-icon-${player.id}`} name="checkmark" size={16} color={rinkGlass.ice} />
          ) : (
            <Text style={styles.addText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Inline comparison */}
      {expanded && hasComparison && (
        <View style={styles.comparison}>
          <View style={styles.comparisonSide}>
            <Text style={styles.comparisonLabel}>Pickup</Text>
            <Text style={styles.comparisonName}>{player.name}</Text>
            <Text style={styles.comparisonPoints}>{player.projectedPoints}</Text>
          </View>
          <View style={styles.comparisonDivider} />
          <View style={styles.comparisonSide}>
            <Text style={styles.comparisonLabel}>Current</Text>
            <Text style={styles.comparisonName}>{player.currentPlayerName}</Text>
            <Text style={styles.comparisonPoints}>{player.currentPlayerPoints}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export default function WaiverWireModule({ players }: WaiverWireModuleProps) {
  const top3 = players.slice(0, 3);

  if (players.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.waiverWire }]} />
          <Text style={styles.title}>Waiver Wire</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color={rinkGlass.textMuted} />
          <Text style={styles.emptyText}>No waiver picks available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.waiverWire }]} />
        <Text style={styles.title}>Waiver Wire</Text>
      </View>
      {top3.map((player, index) => (
        <WaiverCard key={player.id} player={player} rank={index + 1} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  accentStripe: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  title: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: rinkGlass.glassHighlight,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 15,
    color: rinkGlass.textPrimary,
    marginBottom: 2,
  },
  teamPosition: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginBottom: 1,
  },
  ownership: {
    fontSize: 11,
    color: rinkGlass.textMuted,
  },
  valueContainer: {
    marginLeft: 12,
    alignItems: 'center',
  },
  valueScore: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 24,
    color: rinkGlass.faceoffDot,
    lineHeight: 28,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  compareButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  compareText: {
    fontSize: 12,
    color: rinkGlass.blueLight,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: rinkGlass.blueLight,
    minWidth: 52,
    alignItems: 'center',
  },
  addButtonActive: {
    backgroundColor: rinkGlass.faceoffDot,
  },
  addText: {
    fontSize: 12,
    color: rinkGlass.ice,
    fontWeight: '700',
  },
  comparison: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  comparisonSide: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonDivider: {
    width: 1,
    backgroundColor: rinkGlass.glassBorder,
    marginHorizontal: 8,
  },
  comparisonLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  comparisonName: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  comparisonPoints: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 20,
    color: rinkGlass.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: rinkGlass.textMuted,
  },
});
