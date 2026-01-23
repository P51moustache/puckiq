import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

export default function MyIQScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Hockey IQ</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    marginTop: 8,
  },
});
