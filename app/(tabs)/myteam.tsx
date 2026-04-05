import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

export default function MyTeamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Team</Text>
      <Text style={styles.subtext}>
        Set up your fantasy roster to get personalized recommendations
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  subtext: {
    fontSize: 16,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 22,
  },
});
