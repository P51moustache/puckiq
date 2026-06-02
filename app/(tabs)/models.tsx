/**
 * Models Tab Screen
 * Shows model list and handles editing/creating models
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ModelList, ModelEditScreen } from '../../components/model-builder';
import DataSeedingModal from '../../components/DataSeedingModal';
import { supabase } from '../../lib/supabase';
import type { PredictionModel } from '../../types/predictions';

async function isSeasonSeeded(seasonId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('season', parseInt(seasonId));
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
function getCurrentSeasonId(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 0 && month <= 5) return `${year - 1}${year}`;
  return `${year}${year + 1}`;
}

export default function ModelsScreen() {
  // Analytics - tracks screen_view automatically
  const { trackCustomEvent } = useAnalytics('Models');

  // State for edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<PredictionModel | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // State for seeding
  const [isDataSeeded, setIsDataSeeded] = useState<boolean | null>(null);
  const [seedingModalVisible, setSeedingModalVisible] = useState(false);

  // Check if data is seeded on mount
  useEffect(() => {
    checkSeedingStatus();
  }, []);

  const checkSeedingStatus = useCallback(async () => {
    try {
      const seasonId = getCurrentSeasonId();
      const seeded = await isSeasonSeeded(seasonId);
      setIsDataSeeded(seeded);
    } catch (error) {
      console.error('[ModelsScreen] Error checking seeding status:', error);
      setIsDataSeeded(false);
    }
  }, []);

  // Handle seeding complete
  const handleSeedingComplete = useCallback(() => {
    setIsDataSeeded(true);
    trackCustomEvent('data_seeding_completed', {
      season: getCurrentSeasonId(),
    });
  }, [trackCustomEvent]);

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Seeding Banner - show if data not seeded */}
      {isDataSeeded === false && (
        <Pressable
          style={styles.seedingBanner}
          onPress={() => setSeedingModalVisible(true)}
        >
          <View style={styles.seedingBannerIcon}>
            <Ionicons name="stats-chart" size={20} color="#60a5fa" />
          </View>
          <View style={styles.seedingBannerContent}>
            <Text style={styles.seedingBannerTitle}>
              Enable Backtesting
            </Text>
            <Text style={styles.seedingBannerText}>
              Download historical data to test your models
            </Text>
          </View>
          <View style={styles.seedingBannerArrow}>
            <Text style={styles.seedingBannerArrowText}>→</Text>
          </View>
        </Pressable>
      )}

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
          onRequestClose={handleCancelEdit}
        >
          <ModelEditScreen
            model={editingModel}
            onSave={handleSaveModel}
            onCancel={handleCancelEdit}
          />
        </Modal>
      )}

      {/* Data Seeding Modal */}
      <DataSeedingModal
        visible={seedingModalVisible}
        onClose={() => setSeedingModalVisible(false)}
        onSeedingComplete={handleSeedingComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  seedingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.accent}15`,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  seedingBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}22`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  seedingBannerIconText: {
    fontSize: 20,
  },
  seedingBannerContent: {
    flex: 1,
  },
  seedingBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  seedingBannerText: {
    fontSize: 12,
    color: theme.subtext,
  },
  seedingBannerArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seedingBannerArrowText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
});
