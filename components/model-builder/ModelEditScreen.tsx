/**
 * ModelEditScreen Component
 * Full screen modal for creating and editing prediction models
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import type { PredictionModel, ConfidenceWeights, PlayerWeights, ModelBacktestResults } from '../../types/predictions';
import { saveModel, createDefaultModel } from '../../services/modelStorage';
import FactorEditor from './FactorEditor';
import LivePreview from './LivePreview';
import BacktestPanel from './BacktestPanel';
import DataSeedingModal from '../DataSeedingModal';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

interface ModelEditScreenProps {
  model?: PredictionModel | null;  // Existing model to edit, or null/undefined for new model
  onSave: (model: PredictionModel) => void;
  onCancel: () => void;
}

// Get default weights from Classic model
const getDefaultWeights = (): AllWeights => {
  const classic = createDefaultModel();
  return {
    ...classic.weights,
    ...classic.playerWeights,
  };
};

export default function ModelEditScreen({ model, onSave, onCancel }: ModelEditScreenProps) {
  // Is this a new model or editing existing?
  const isNewModel = !model;

  // Form state
  const [name, setName] = useState(model?.name || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [weights, setWeights] = useState<AllWeights>(() => {
    if (model) {
      // Editing existing model - use its weights
      return {
        ...model.weights,
        ...model.playerWeights,
      };
    }
    // New model - start with Classic weights
    return getDefaultWeights();
  });
  const [saving, setSaving] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [backtestResults, setBacktestResults] = useState<ModelBacktestResults | undefined>(
    model?.backtestResults
  );
  const [seedingModalVisible, setSeedingModalVisible] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Track if weights have changed from initial state
  const initialWeightsRef = React.useRef<AllWeights>(weights);

  // Check for unsaved changes
  useEffect(() => {
    const nameChanged = name !== (model?.name || '');
    const weightsChanged = JSON.stringify(weights) !== JSON.stringify(initialWeightsRef.current);
    setHasUnsavedChanges(nameChanged || weightsChanged);
  }, [name, weights, model]);

  // Validate name
  const validateName = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setNameError('Model name is required');
      return false;
    }
    if (value.trim().length < 2) {
      setNameError('Model name must be at least 2 characters');
      return false;
    }
    if (value.trim().length > 50) {
      setNameError('Model name must be less than 50 characters');
      return false;
    }
    setNameError(null);
    return true;
  }, []);

  // Handle name change
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (nameError) {
      validateName(value);
    }
  }, [nameError, validateName]);

  // Handle name blur (validate on blur)
  const handleNameBlur = useCallback(() => {
    validateName(name);
  }, [name, validateName]);

  // Handle weights change
  const handleWeightsChange = useCallback((newWeights: AllWeights) => {
    setWeights(newWeights);
  }, []);

  // Handle backtest results save
  const handleBacktestResultsSave = useCallback((results: ModelBacktestResults) => {
    setBacktestResults(results);
    setHasUnsavedChanges(true);
  }, []);

  // Handle seed prompt from BacktestPanel
  const handleSeedPrompt = useCallback(() => {
    setSeedingModalVisible(true);
  }, []);

  // Toggle preview expansion
  const togglePreview = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPreviewExpanded(prev => !prev);
  }, []);

  // Handle cancel with unsaved changes warning
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onCancel },
        ]
      );
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel]);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate name
    if (!validateName(name)) {
      return;
    }

    try {
      setSaving(true);

      // Build model object
      const modelToSave: PredictionModel = {
        id: model?.id || '', // Empty string for new models - saveModel will generate ID
        name: name.trim(),
        createdAt: model?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        weights: {
          standingsDifferential: weights.standingsDifferential,
          homeIceAdvantage: weights.homeIceAdvantage,
          streakImpact: weights.streakImpact,
          goalDifferentialImpact: weights.goalDifferentialImpact,
          recentFormImpact: weights.recentFormImpact,
          backToBackPenalty: weights.backToBackPenalty,
          restAdvantage: weights.restAdvantage,
          specialTeamsImpact: weights.specialTeamsImpact,
          shotDifferentialImpact: weights.shotDifferentialImpact,
        },
        playerWeights: {
          goalieMatchupImpact: weights.goalieMatchupImpact,
          hotPlayersImpact: weights.hotPlayersImpact,
        },
        isActive: model?.isActive || false,
        isDefault: model?.isDefault || false,
        backtestResults: backtestResults,
      };

      // Save to storage
      const savedModel = await saveModel(modelToSave);
      onSave(savedModel);
    } catch (error) {
      console.error('[MODEL_EDIT] Error saving model:', error);
      Alert.alert(
        'Save Failed',
        'Failed to save the model. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  }, [name, weights, model, backtestResults, validateName, onSave]);

  // Screen title
  const title = isNewModel ? 'New Model' : 'Edit Model';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCancel}
          disabled={saving}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{title}</Text>

        <TouchableOpacity
          style={[styles.headerButton, styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={[styles.saveText, !name.trim() && styles.saveTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        {/* Model Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Name</Text>
          <TextInput
            style={[styles.nameInput, nameError && styles.nameInputError]}
            value={name}
            onChangeText={handleNameChange}
            onBlur={handleNameBlur}
            placeholder="Enter model name..."
            placeholderTextColor={theme.subtext}
            maxLength={50}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!saving}
          />
          {nameError && (
            <Text style={styles.errorText}>{nameError}</Text>
          )}
          {model?.isDefault && (
            <View style={styles.classicBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.classicBadgeText}>
                This is the default PuckIQ Classic model
              </Text>
            </View>
          )}
        </View>

        {/* Live Preview (Collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={togglePreview}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name={previewExpanded ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color={theme.accent}
              />
              <Text style={styles.sectionTitle}>Live Preview</Text>
            </View>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>
                {previewExpanded ? 'Tap to collapse' : 'Tap to expand'}
              </Text>
            </View>
          </TouchableOpacity>

          {previewExpanded && (
            <View style={styles.previewContainer}>
              <LivePreview weights={weights} />
            </View>
          )}
        </View>

        {/* Backtest Panel */}
        {!isNewModel && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backtest</Text>
            <Text style={styles.sectionDescription}>
              Test your model against historical game results
            </Text>
            <BacktestPanel
              model={{
                id: model?.id || '',
                name: name || 'Untitled Model',
                createdAt: model?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                weights: {
                  standingsDifferential: weights.standingsDifferential,
                  homeIceAdvantage: weights.homeIceAdvantage,
                  streakImpact: weights.streakImpact,
                  goalDifferentialImpact: weights.goalDifferentialImpact,
                  recentFormImpact: weights.recentFormImpact,
                  backToBackPenalty: weights.backToBackPenalty,
                  restAdvantage: weights.restAdvantage,
                  specialTeamsImpact: weights.specialTeamsImpact,
                  shotDifferentialImpact: weights.shotDifferentialImpact,
                },
                playerWeights: {
                  goalieMatchupImpact: weights.goalieMatchupImpact,
                  hotPlayersImpact: weights.hotPlayersImpact,
                },
                isActive: model?.isActive || false,
                isDefault: model?.isDefault || false,
              }}
              onSaveResults={handleBacktestResultsSave}
              onSeedPrompt={handleSeedPrompt}
            />
          </View>
        )}

        {/* Factor Editor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weight Factors</Text>
          <Text style={styles.sectionDescription}>
            Adjust how much each factor influences predictions
          </Text>
          <View style={styles.factorEditorContainer}>
            <FactorEditor
              weights={weights}
              onChange={handleWeightsChange}
              onSliderDragStart={() => setScrollEnabled(false)}
              onSliderDragEnd={() => setScrollEnabled(true)}
            />
          </View>
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Data Seeding Modal */}
      <DataSeedingModal
        visible={seedingModalVisible}
        onClose={() => setSeedingModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 16,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  cancelText: {
    fontSize: 16,
    color: theme.accent,
  },
  saveButton: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  saveTextDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.subtle,
  },
  nameInputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  classicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.card,
    borderRadius: 8,
  },
  classicBadgeText: {
    fontSize: 12,
    color: theme.subtext,
    fontStyle: 'italic',
  },
  previewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.subtle,
    borderRadius: 6,
  },
  previewBadgeText: {
    fontSize: 11,
    color: theme.subtext,
  },
  previewContainer: {
    marginTop: 4,
  },
  factorEditorContainer: {
    backgroundColor: theme.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bottomSpacer: {
    height: 100,
  },
});
