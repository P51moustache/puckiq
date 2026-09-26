/**
 * Header control: active team name; tap to switch leagues, add one, or edit league rules.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLATFORM_LABEL, teamLimit } from '../../services/teams';
import { slotsLabel } from '../../services/fantasy/lineup';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import LeagueSettingsSheet from '../sheets/LeagueSettingsSheet';
import { colors, ProBadge } from './ui';

export default function TeamSwitcher() {
  const { teams, team, setActiveTeam, addTeam } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!team) return null;
  const canAdd = teams.length < teamLimit(isPremium);

  const handleAdd = () => {
    setOpen(false);
    if (!canAdd) {
      if (!isPremium) openPaywall('teams');
      return;
    }
    addTeam({ name: `Team ${teams.length + 1}`, platform: team.platform, slots: team.slots });
    setSettingsOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Team: ${team.name}. Switch or edit team`}
        testID="team-switcher"
        hitSlop={6}
      >
        <View style={styles.triggerDot} />
        <Text style={styles.triggerText} numberOfLines={1}>{team.name}</Text>
        <Ionicons name="chevron-down" size={13} color={colors.onInk} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close team menu">
          <Pressable style={styles.menu} onPress={() => undefined}>
            <Text style={styles.menuTitle}>YOUR TEAMS</Text>
            {teams.map((row) => {
              const active = row.id === team.id;
              return (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setActiveTeam(row.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.teamRow, pressed && styles.pressed]}
                  testID={`team-row-${row.id}`}
                >
                  <View style={styles.teamText}>
                    <Text style={[styles.teamName, active && styles.teamNameActive]} numberOfLines={1}>{row.name}</Text>
                    <Text style={styles.teamMeta} numberOfLines={1}>
                      {PLATFORM_LABEL[row.platform]} · {row.players.length} players · {slotsLabel(row.slots)}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
            <View style={styles.divider} />
            <Pressable
              onPress={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              testID="team-settings"
            >
              <Ionicons name="options-outline" size={18} color={colors.text} />
              <Text style={styles.actionText}>League settings</Text>
            </Pressable>
            <Pressable onPress={handleAdd} style={({ pressed }) => [styles.action, pressed && styles.pressed]} testID="team-add">
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={styles.actionText}>Add another league</Text>
              {!isPremium ? <ProBadge small /> : null}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <LeagueSettingsSheet visible={settingsOpen} team={team} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: 230,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  triggerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.onInk,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21,21,30,0.45)',
    justifyContent: 'flex-start',
    paddingTop: 110,
    paddingHorizontal: 16,
  },
  menu: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colors.muted,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  teamText: {
    flex: 1,
  },
  teamName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  teamNameActive: {
    color: colors.accent,
  },
  teamMeta: {
    fontSize: 11,
    color: colors.sub,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
});
