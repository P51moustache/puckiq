import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PredictionModel } from '../../types/predictions';
import {
  loadModels,
  setActiveModel,
  deleteModel,
  duplicateModel,
  isClassicModel,
} from '../../services/modelStorage';
import ModelAccuracyCard from '../ModelAccuracyCard';
import { useArena } from '../arena/ArenaProvider';
import { arenaType } from '../../constants/arenaTypography';
import { createSubmissionGate } from './submissionGate';
import type { ArenaPalette } from '../../constants/arenaTheme';

interface ModelListProps {
  onEditModel: (model: PredictionModel) => void;
  onNewModel: () => void;
}

export default function ModelList({ onEditModel, onNewModel }: ModelListProps) {
  const { palette: p } = useArena();
  const styles = useMemo(() => createStyles(p), [p]);
  const [models, setModels] = useState<PredictionModel[]>([]);
  const [loading, setLoading] = useState(true);

  // State for duplicate modal
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateModelSource, setDuplicateModelSource] = useState<PredictionModel | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const duplicateGateRef = useRef(createSubmissionGate());

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
    if (duplicateGateRef.current.isBusy()) return;
    setDuplicateModalVisible(false);
    setDuplicateModelSource(null);
    setDuplicateName('');
  }, []);

  // Confirm duplicate
  const confirmDuplicate = useCallback(async () => {
    if (duplicateGateRef.current.isBusy()) return;
    if (!duplicateModelSource) return;

    if (!duplicateName || duplicateName.trim() === '') {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    await duplicateGateRef.current.run(async () => {
      try {
      setIsDuplicating(true);
      await duplicateModel(duplicateModelSource.id, duplicateName.trim());
      setDuplicateModalVisible(false);
      setDuplicateModelSource(null);
      setDuplicateName('');
      await fetchModels();
      } catch (error) {
        console.error('[MODEL_LIST] Error duplicating model:', error);
        Alert.alert('Error', 'Failed to duplicate model');
      } finally {
        setIsDuplicating(false);
      }
    });
  }, [duplicateModelSource, duplicateName, fetchModels]);

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
  const renderModelCard = ({ item: model }: { item: PredictionModel }) => {
    const isClassic = isClassicModel(model);
    const hasBacktest = model.backtestResults?.replayVersion === 'four-factor-pregame-v1';

    return (
      <View
        style={[styles.card, { backgroundColor: p.paper, borderColor: model.isActive ? p.action : p.edge }]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: p.ink, fontFamily: arenaType.body }]} numberOfLines={1}>
              {model.name}
            </Text>
            {isClassic && (
              <View style={[styles.classicBadge, { backgroundColor: p.soft }]}>
                <Text style={[styles.classicBadgeText, { color: p.link }]}>Classic</Text>
              </View>
            )}
          </View>
          {model.isActive && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.activeBadgeText}>Local selection</Text>
            </View>
          )}
        </View>

        {/* Accuracy (if backtested) */}
        {hasBacktest && model.backtestResults && (
          <View style={[styles.accuracyContainer, { backgroundColor: p.soft }]}>
            <View style={styles.accuracyStat}>
              <Text style={[styles.accuracyLabel, { color: p.muted }]}>4-factor replay</Text>
              <Text style={[styles.accuracyValue, { color: p.ink }]}>
                {model.backtestResults.accuracy.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={[styles.accuracyLabel, { color: p.muted }]}>vs Classic replay</Text>
              <Text
                style={[
                  styles.accuracyValue,
                  model.backtestResults.accuracy > model.backtestResults.baselineAccuracy
                    ? styles.accuracyPositive
                    : model.backtestResults.accuracy < model.backtestResults.baselineAccuracy
                    ? styles.accuracyNegative
                    : { color: p.ink },
                ]}
              >
                {model.backtestResults.accuracy > model.backtestResults.baselineAccuracy ? '+' : ''}
                {(model.backtestResults.accuracy - model.backtestResults.baselineAccuracy).toFixed(1)} pp
              </Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={[styles.accuracyLabel, { color: p.muted }]}>Games</Text>
              <Text style={[styles.accuracyValue, { color: p.ink }]}>
                {model.backtestResults.totalGames}
              </Text>
            </View>
          </View>
        )}

        {!hasBacktest && (
          <Text style={[styles.noBacktest, { color: p.muted }]}>No four-factor replay yet</Text>
        )}

        {/* Real-World Accuracy */}
        <ModelAccuracyCard
          modelId={model.id}
          modelName={model.name}
          compact={true}
        />

        <Pressable
          style={[styles.activateButton, { backgroundColor: model.isActive ? p.soft : p.action, borderColor: p.frame }]}
          onPress={() => handleActivate(model)}
          disabled={model.isActive}
          accessibilityRole="button"
          accessibilityLabel={model.isActive ? `${model.name} is the local selection` : `Use ${model.name} for local experiments`}
          accessibilityState={{ selected: model.isActive, disabled: model.isActive }}
        >
          <Text style={[styles.activateButtonText, { color: model.isActive ? p.muted : p.actionInk }]}>{model.isActive ? 'Selected for local experiments' : 'Use for local experiments'}</Text>
        </Pressable>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            testID={`model-edit-${model.id}`}
            style={[styles.actionButton, { backgroundColor: p.soft }]}
            onPress={() => onEditModel(model)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${model.name}`}
          >
            <Ionicons name="pencil-outline" size={18} color={p.link} />
            <Text style={[styles.actionButtonText, { color: p.link }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`model-duplicate-${model.id}`}
            style={[styles.actionButton, { backgroundColor: p.soft }]}
            onPress={() => handleDuplicate(model)}
            accessibilityRole="button"
            accessibilityLabel={`Duplicate ${model.name}`}
          >
            <Ionicons name="copy-outline" size={18} color={p.link} />
            <Text style={[styles.actionButtonText, { color: p.link }]}>Duplicate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`model-delete-${model.id}`}
            style={[styles.actionButton, { backgroundColor: p.soft }, isClassic && styles.actionButtonDisabled]}
            onPress={() => handleDelete(model)}
            disabled={isClassic}
            accessibilityRole="button"
            accessibilityLabel={isClassic ? `${model.name} cannot be deleted` : `Delete ${model.name}`}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={isClassic ? p.muted : '#ef4444'}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: isClassic ? p.muted : '#ef4444' },
              ]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: p.page }]}>
        <ActivityIndicator size="large" color={p.action} />
        <Text style={[styles.loadingText, { color: p.muted }]}>Loading models...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: p.page }]}>
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
            tintColor={p.action}
            colors={[p.action]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.publishedCard, { backgroundColor: p.frame, borderColor: p.action }]}>
              <View style={styles.publishedTitleRow}>
                <Ionicons name="shield-checkmark-outline" size={22} color={p.action} />
                <Text style={[styles.publishedTitle, { color: p.frameInk }]}>Published PuckIQ AI</Text>
                <View style={[styles.readOnlyBadge, { backgroundColor: p.action }]}>
                  <Text style={[styles.readOnlyText, { color: p.actionInk }]}>Read only</Text>
                </View>
              </View>
              <Text style={[styles.publishedBody, { color: p.frameInk }]}>Arena forecasts are published by PuckIQ AI with their source and publication time. Changing a personal model never changes those published probabilities.</Text>
            </View>
            <Text accessibilityRole="header" style={[styles.localHeading, { color: p.ink }]}>My model experiments</Text>
            <Text style={[styles.localDescription, { color: p.muted }]}>Choose local weights for previews and four-factor historical replay. These experiments stay on this device.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={48} color={p.muted} />
            <Text style={[styles.emptyTitle, { color: p.ink }]}>No personal models</Text>
            <Text style={[styles.emptyText, { color: p.muted }]}>
              Create your first custom prediction model
            </Text>
          </View>
        }
      />

      {/* FAB Button for New Model */}
      <TouchableOpacity
        testID="model-create-fab"
        style={[styles.fab, { backgroundColor: p.action, borderColor: p.frame }]}
        onPress={onNewModel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Create personal model"
      >
        <Ionicons name="add" size={28} color={p.actionInk} />
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
          accessibilityRole="button"
          accessibilityLabel="Close duplicate model dialog"
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
              placeholderTextColor={p.muted}
              autoFocus
              selectTextOnFocus
              accessibilityLabel="Duplicate model name"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeDuplicateModal}
                accessibilityRole="button"
                accessibilityLabel="Cancel duplicate model"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmDuplicate}
                disabled={isDuplicating}
                accessibilityRole="button"
                accessibilityLabel={isDuplicating ? 'Duplicating model' : 'Duplicate model'}
              >
                <Text style={styles.modalConfirmText}>{isDuplicating ? 'Duplicating…' : 'Duplicate'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (p: ArenaPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: p.page,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: p.page,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: p.muted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  publishedCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  publishedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  publishedTitle: { flex: 1, fontFamily: arenaType.display, fontSize: 24 },
  readOnlyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  readOnlyText: { fontFamily: arenaType.body, fontSize: 11, fontWeight: '800' },
  publishedBody: { fontFamily: arenaType.body, fontSize: 14, lineHeight: 20, opacity: 0.88 },
  localHeading: { fontFamily: arenaType.display, fontSize: 30, marginBottom: 4 },
  localDescription: { fontFamily: arenaType.body, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  // Card Styles
  card: {
    backgroundColor: p.paper,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    color: p.ink,
    flex: 1,
  },
  classicBadge: {
    backgroundColor: p.soft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: p.link,
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
    backgroundColor: p.soft,
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
    color: p.muted,
    marginBottom: 4,
  },
  accuracyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: p.ink,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  accuracyPositive: {
    color: '#10b981',
  },
  accuracyNegative: {
    color: '#ef4444',
  },
  noBacktest: {
    fontSize: 13,
    color: p.muted,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  // Action Button Styles
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: p.edge,
    paddingTop: 12,
  },
  activateButton: { minHeight: 48, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingHorizontal: 12 },
  activateButtonText: { fontFamily: arenaType.body, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: p.soft,
    borderRadius: 8,
    minHeight: 48,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: p.link,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: p.ink,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: p.muted,
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
    backgroundColor: p.action,
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
    backgroundColor: p.paper,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: p.edge,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: p.ink,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: p.muted,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: p.soft,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: p.ink,
    borderWidth: 1,
    borderColor: p.edge,
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
    minHeight: 48,
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: p.soft,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: p.muted,
  },
  modalConfirmButton: {
    backgroundColor: p.action,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: p.actionInk,
  },
});
