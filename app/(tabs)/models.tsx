/**
 * Models Tab Screen
 * Shows model list and handles editing/creating models
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Modal,
  StatusBar,
  View,
  Text,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ModelList, ModelEditScreen } from '../../components/model-builder';
import type { ModelEditScreenHandle } from '../../components/model-builder/ModelEditScreen';
import type { PredictionModel } from '../../types/predictions';
import { useArena } from '../../components/arena/ArenaProvider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { arenaType } from '../../constants/arenaTypography';
import { leaveModels } from '../../components/model-builder/modelNavigation';

export default function ModelsScreen() {
  const { palette: p } = useArena();
  // Analytics - tracks screen_view automatically
  const { trackCustomEvent } = useAnalytics('Models');

  // State for edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<PredictionModel | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const editorRef = useRef<ModelEditScreenHandle>(null);
  const handleBack = useCallback(() => leaveModels(router), []);

  // Handle create new model
  const handleNewModel = useCallback(() => {
    setEditingModel(null); // null = new model
    setEditModalVisible(true);
  }, []);

  // Handle edit existing model
  const handleEditModel = useCallback((model: PredictionModel) => {
    setEditingModel(model);
    setEditModalVisible(true);
  }, []);

  // Handle save model (from edit screen)
  const handleSaveModel = useCallback((savedModel: PredictionModel) => {
    // Track analytics
    if (editingModel) {
      // Editing existing model
      trackCustomEvent('model_edited', {
        model_id: savedModel.id,
        model_name: savedModel.name,
        is_default: savedModel.isDefault,
      });
    } else {
      // Creating new model
      trackCustomEvent('model_created', {
        model_id: savedModel.id,
        model_name: savedModel.name,
      });
    }

    // Close modal and refresh list
    setEditModalVisible(false);
    setEditingModel(null);
    setRefreshKey(prev => prev + 1); // Force ModelList to refresh
  }, [editingModel, trackCustomEvent]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditModalVisible(false);
    setEditingModel(null);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.page }]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { borderBottomColor: p.edge, backgroundColor: p.page }]}>
        <Pressable
          style={({ pressed }) => [styles.backButton, { borderColor: p.edge, backgroundColor: p.paper, opacity: pressed ? 0.7 : 1 }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to League"
        >
          <Ionicons name="chevron-back" size={22} color={p.ink} />
          <Text style={[styles.backText, { color: p.ink }]}>League</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>Models</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Model List */}
      <ModelList
        key={refreshKey}
        onEditModel={handleEditModel}
        onNewModel={handleNewModel}
      />

      {/* Edit/Create Model Modal - only render content when visible */}
      {editModalVisible && (
        <Modal
          visible={editModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => editorRef.current?.requestClose()}
        >
          <ModelEditScreen
            ref={editorRef}
            model={editingModel}
            onSave={handleSaveModel}
            onCancel={handleCancelEdit}
          />
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: { minHeight: 58, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 48, minWidth: 88, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  backText: { fontFamily: arenaType.body, fontWeight: '700', fontSize: 14 },
  title: { fontFamily: arenaType.display, fontSize: 30 },
  headerSpacer: { width: 88 },
});
