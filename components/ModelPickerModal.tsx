import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface ModelOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface ModelPickerModalProps {
  visible: boolean;
  allModels: ModelOption[];
  activeModelId: string | undefined;
  onModelSwitch: (modelId: string) => void;
  onClose: () => void;
}

export default function ModelPickerModal({
  visible,
  allModels,
  activeModelId,
  onModelSwitch,
  onClose,
}: ModelPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Select Model</Text>
          {allModels.map((model) => (
            <TouchableOpacity
              key={model.id}
              testID={`model-option-${model.id}`}
              onPress={() => onModelSwitch(model.id)}
              style={[
                styles.option,
                model.id === activeModelId && styles.optionActive,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionName}>{model.name}</Text>
                {model.isDefault && (
                  <Text style={styles.optionDefault}>Default</Text>
                )}
              </View>
              {model.id === activeModelId && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            testID="model-picker-cancel"
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: theme.subtle,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: theme.factbox,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 10,
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: theme.card,
  },
  optionName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionDefault: {
    color: '#8b5cf6',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#10b981',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
