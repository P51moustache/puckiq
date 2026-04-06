import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';

interface StartSitPlayer {
  id: number;
  name: string;
  team: string;
  opponent: string;
  projectedPoints: number;
  recommendation: 'START' | 'SIT';
}

interface StartSitModuleProps {
  players: StartSitPlayer[];
}

function PlayerCard({ player, index }: { player: StartSitPlayer; index: number }) {
  const [decision, setDecision] = useState<'START' | 'SIT'>(player.recommendation);
  const isStart = decision === 'START';

  const toggleBgColor = useSharedValue(isStart ? rinkGlass.faceoffDot : rinkGlass.textMuted);

  const handleToggle = () => {
    const newDecision = decision === 'START' ? 'SIT' : 'START';
    setDecision(newDecision);
    toggleBgColor.value = withTiming(
      newDecision === 'START' ? rinkGlass.faceoffDot : rinkGlass.textMuted
    );
  };

  const animatedToggleStyle = useAnimatedStyle(() => ({
    backgroundColor: toggleBgColor.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={styles.card}
    >
      {/* Player icon placeholder */}
      <View style={styles.iconContainer}>
        <Ionicons name="person" size={28} color={rinkGlass.textSecondary} />
      </View>

      {/* Player info */}
      <Text style={styles.playerName}>{player.name}</Text>
      <Text style={styles.teamLabel}>{player.team}</Text>
      <Text style={styles.opponentLabel}>vs {player.opponent}</Text>

      {/* Projected points */}
      <Text style={styles.projectedPoints}>{player.projectedPoints}</Text>
      <Text style={styles.projLabel}>proj pts</Text>

      {/* Toggle button */}
      <TouchableOpacity
        testID={`toggle-${player.id}`}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Animated.View style={[styles.toggleButton, animatedToggleStyle]}>
          <Text style={styles.toggleText}>{decision}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StartSitModule({ players }: StartSitModuleProps) {
  if (players.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.startSit }]} />
          <Text style={styles.title}>Start / Sit</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="moon-outline" size={32} color={rinkGlass.textMuted} />
          <Text style={styles.emptyText}>No players playing tonight</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.startSit }]} />
        <Text style={styles.title}>Start / Sit</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {players.map((player, index) => (
          <PlayerCard key={player.id} player={player} index={index} />
        ))}
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 16,
    padding: 16,
    width: 160,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: rinkGlass.glassHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  teamLabel: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  opponentLabel: {
    fontSize: 12,
    color: rinkGlass.textMuted,
    marginBottom: 10,
  },
  projectedPoints: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 32,
    color: rinkGlass.textPrimary,
    lineHeight: 36,
  },
  projLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  toggleButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.ice,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
