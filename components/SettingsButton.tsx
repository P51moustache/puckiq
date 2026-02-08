import { TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { theme } from '../constants/theme';

export function SettingsButton() {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => {/* TODO: add settings screen */}}
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
