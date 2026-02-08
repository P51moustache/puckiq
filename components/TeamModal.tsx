import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { theme } from '../constants/theme';

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TeamModalProps {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  teamAbbrev: string;
  tabs: Tab[];
  renderTabContent: (tabId: string) => React.ReactNode;
  initialTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function TeamModal({
  visible,
  onClose,
  teamName,
  teamAbbrev,
  tabs,
  renderTabContent,
  initialTab,
  onTabChange,
}: TeamModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Reset to initial tab when modal opens
  React.useEffect(() => {
    if (visible) {
      setActiveTab(initialTab || tabs[0]?.id);
    }
  }, [visible, initialTab, tabs]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>{teamAbbrev}</Text>
            </View>
            <View>
              <Text style={styles.teamName}>{teamName}</Text>
              <Text style={styles.teamAbbrev}>{teamAbbrev}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark.circle.fill" size={28} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContent}
          >
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.activeTab,
                ]}
                onPress={() => handleTabChange(tab.id)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.id && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content Area */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderTabContent(activeTab)}
        </ScrollView>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
    backgroundColor: theme.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.factbox,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.accent + '44',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.accent,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  teamAbbrev: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
    backgroundColor: theme.card,
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    gap: 4,
    flexGrow: 1,
    justifyContent: 'center',
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    position: 'relative',
  },
  activeTab: {
    // Active styling handled by indicator
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  activeTabText: {
    color: theme.accent,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.accent,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60,
  },
});
