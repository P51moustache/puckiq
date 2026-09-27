/**
 * Shown while the onboarding sample roster is on the active team, so sample stars
 * never pass for the user's own players. One tap clears them and keeps anyone added.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hasSamplePlayers, sampleCount, withoutSample } from '../../constants/sampleTeam';
import { track } from '../../services/analytics/track';
import { useTeams } from '../TeamsProvider';
import { Card, colors, GhostButton } from './ui';

export default function SampleTeamNotice({ style }: { style?: object }) {
  const { team, updateTeam } = useTeams();
  if (!team || !hasSamplePlayers(team)) return null;
  const count = sampleCount(team.players);
  const own = team.players.length - count;

  return (
    <Card style={[styles.card, style]} testID="sample-team-notice">
      <View style={styles.head}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>SAMPLE</Text>
        </View>
        <Text style={styles.title}>{count} sample players</Text>
      </View>
      <Text style={styles.body}>
        These are PuckIQ’s demo roster, not your team.{own > 0 ? ` The ${own} you added stay.` : ''}
      </Text>
      <GhostButton
        label="Remove sample players"
        icon="trash-outline"
        tone="accent"
        onPress={() => {
          track('sample_team_cleared', { kept: own });
          updateTeam((current) => withoutSample(current));
        }}
        style={styles.button}
        testID="sample-team-clear"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.onAccent,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
    marginTop: 6,
  },
  button: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
});
