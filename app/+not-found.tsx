import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ArenaButton, arenaType } from '../components/arena/ArenaPrimitives';
import { useArena } from '../components/arena/ArenaProvider';

export default function NotFoundScreen() {
  const { palette: p } = useArena();
  return (
    <>
      <Stack.Screen options={{ title: 'Unavailable' }} />
      <View style={[styles.container, { backgroundColor: p.page }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>PAGE UNAVAILABLE</Text>
        <Text style={[styles.copy, { color: p.muted }]}>This link is unsupported or no longer available. Return Home to continue with the current schedule.</Text>
        <ArenaButton label="Return Home" icon="home-outline" onPress={() => router.replace('/(tabs)')} style={styles.button} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontFamily: arenaType.display, fontSize: 48 },
  copy: { fontFamily: arenaType.body, fontSize: 15, lineHeight: 23, marginTop: 8 },
  button: { marginTop: 22 },
});
