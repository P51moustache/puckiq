import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from './ui/IconSymbol';
import { theme } from '../constants/theme';

export function SettingsButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push('/settings')}
      accessibilityLabel="Settings"
    >
      <IconSymbol name="gearshape.fill" size={24} color={theme.subtext} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
