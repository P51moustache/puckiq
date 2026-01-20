import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import type { PredictionModel } from '../../types/predictions';
import {
  loadModels,
  setActiveModel,
  deleteModel,
  duplicateModel,
  isClassicModel,
} from '../../services/modelStorage';
import ModelAccuracyCard from '../ModelAccuracyCard';

interface ModelListProps {
  onEditModel: (model: PredictionModel) => void;
  onNewModel: () => void;
}

export default function ModelList({ onEditModel, onNewModel }: ModelListProps) {
  const [models, setModels] = useState<PredictionModel[]>([]);
  const [loading, setLoading] = useState(true);

  // State for duplicate modal
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateModelSource, setDuplicateModelSource] = useState<PredictionModel | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Load models on mount
  const fetchModels = useCallback(async () => {
    try {
      const loadedModels = await loadModels();
      setModels(loadedModels);
    } catch (error) {
      console.error('[MODEL_LIST] Error loading models:', error);
      Alert.alert('Error', 'Failed to load models');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchModels();
  }, [fetchModels]);

  // Activate model
  const handleActivate = useCallback(async (model: PredictionModel) => {
    if (model.isActive) return;

    try {
      await setActiveModel(model.id);
      await fetchModels();
    } catch (error) {
      console.error('[MODEL_LIST] Error activating model:', error);
      Alert.alert('Error', 'Failed to activate model');
    }
  }, [fetchModels]);

  // Open duplicate modal
  const handleDuplicate = useCallback((model: PredictionModel) => {
    setDuplicateModelSource(model);
    setDuplicateName(`${model.name} Copy`);
    setDuplicateModalVisible(true);
  }, []);

  // Close duplicate modal
  const closeDuplicateModal = useCallback(() => {
    setDuplicateModalVisible(false);
    setDuplicateModelSource(null);
    setDuplicateName('');
  }, []);

  // Confirm duplicate
  const confirmDuplicate = useCallback(async () => {
    if (!duplicateModelSource) return;

    if (!duplicateName || duplicateName.trim() === '') {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    try {
      await duplicateModel(duplicateModelSource.id, duplicateName.trim());
      closeDuplicateModal();
      await fetchModels();
    } catch (error) {
      console.error('[MODEL_LIST] Error duplicating model:', error);
      Alert.alert('Error', 'Failed to duplicate model');
    }
  }, [duplicateModelSource, duplicateName, fetchModels, closeDuplicateModal]);

  // Delete model
  const handleDelete = useCallback(async (model: PredictionModel) => {
    if (isClassicModel(model)) {
      Alert.alert('Cannot Delete', 'The Classic model cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete "${model.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteModel(model.id);
              await fetchModels();
            } catch (error) {
              console.error('[MODEL_LIST] Error deleting model:', error);
              Alert.alert('Error', 'Failed to delete model');
            }
          },
        },
      ]
    );
  }, [fetchModels]);

  // Render model card
  const renderModelCard = useCallback(({ item: model }: { item: PredictionModel }) => {
    const isClassic = isClassicModel(model);
    const hasBacktest = !!model.backtestResults;

    return (
      <TouchableOpacity
        style={[styles.card, model.isActive && styles.cardActive]}
        onPress={() => handleActivate(model)}
        activeOpacity={0.7}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {model.name}
            </Text>
            {isClassic && (
              <View style={styles.classicBadge}>
                <Text style={styles.classicBadgeText}>Classic</Text>
              </View>
            )}
          </View>
          {model.isActive && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>

        {/* Accuracy (if backtested) */}
        {hasBacktest && model.backtestResults && (
          <View style={styles.accuracyContainer}>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyLabel}>Accuracy</Text>
              <Text style={styles.accuracyValue}>
                {model.backtestResults.accuracy.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyLabel}>vs Classic</Text>
              <Text
                style={[
                  styles.accuracyValue,
                  model.backtestResults.accuracy > model.backtestResults.baselineAccuracy
                    ? styles.accuracyPositive
                    : model.backtestResults.accuracy < model.backtestResults.baselineAccuracy
                    ? styles.accuracyNegative
                    : null,
                ]}
              >
                {model.backtestResults.accuracy > model.backtestResults.baselineAccuracy ? '+' : ''}
                {(model.backtestResults.accuracy - model.backtestResults.baselineAccuracy).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyLabel}>Games</Text>
              <Text style={styles.accuracyValue}>
                {model.backtestResults.totalGames}
              </Text>
            </View>
          </View>
        )}

        {!hasBacktest && (
          <Text style={styles.noBacktest}>Not backtested yet</Text>
        )}

        {/* Real-World Accuracy */}
        <ModelAccuracyCard
          modelId={model.id}
          modelName={model.name}
          compact={true}
        />

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            testID={`model-edit-${model.id}`}
            style={styles.actionButton}
            onPress={() => onEditModel(model)}
          >
            <Ionicons name="pencil-outline" size={18} color={theme.accent} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`model-duplicate-${model.id}`}
            style={styles.actionButton}
            onPress={() => handleDuplicate(model)}
          >
            <Ionicons name="copy-outline" size={18} color={theme.accent} />
            <Text style={styles.actionButtonText}>Duplicate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`model-delete-${model.id}`}
            style={[styles.actionButton, isClassic && styles.actionButtonDisabled]}
            onPress={() => handleDelete(model)}
            disabled={isClassic}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={isClassic ? theme.subtext : '#ef4444'}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: isClassic ? theme.subtext : '#ef4444' },
              ]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [handleActivate, handleDuplicate, handleDelete, onEditModel]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading models...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={models}
        renderItem={renderModelCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={48} color={theme.subtext} />
            <Text style={styles.emptyTitle}>No Models</Text>
            <Text style={styles.emptyText}>
              Create your first custom prediction model
            </Text>
          </View>
        }
      />

      {/* FAB Button for New Model */}
      <TouchableOpacity
        testID="model-create-fab"
        style={styles.fab}
        onPress={onNewModel}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Duplicate Model Modal */}
      <Modal
        visible={duplicateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDuplicateModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeDuplicateModal}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Duplicate Model</Text>
            <Text style={styles.modalDescription}>
              Enter a name for the new model:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={duplicateName}
              onChangeText={setDuplicateName}
              placeholder="Model name"
              placeholderTextColor={theme.subtext}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeDuplicateModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmDuplicate}
              >
                <Text style={styles.modalConfirmText}>Duplicate</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.subtext,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  // Card Styles
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  classicBadge: {
    backgroundColor: theme.accent + '33',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  // Accuracy Styles
  accuracyContainer: {
    flexDirection: 'row',
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 16,
  },
  accuracyStat: {
    flex: 1,
    alignItems: 'center',
  },
  accuracyLabel: {
    fontSize: 11,
    color: theme.subtext,
    marginBottom: 4,
  },
  accuracyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  accuracyPositive: {
    color: '#10b981',
  },
  accuracyNegative: {
    color: '#ef4444',
  },
  noBacktest: {
    fontSize: 13,
    color: theme.subtext,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  // Action Button Styles
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: theme.factbox,
    borderRadius: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 8,
    textAlign: 'center',
  },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  // Duplicate Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: theme.subtext,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: theme.factbox,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.subtle,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: theme.factbox,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.subtext,
  },
  modalConfirmButton: {
    backgroundColor: theme.accent,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
