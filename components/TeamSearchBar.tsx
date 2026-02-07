import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export interface Team {
  triCode: string;
  fullName: string;
}

interface TeamSearchBarProps {
  teams: Team[];
  favoriteTeams: string[]; // Array of triCodes
  selectedTeam: string | null; // triCode
  onSelectTeam: (triCode: string, fullName: string) => void;
  onToggleFavorite: (triCode: string, fullName: string) => void;
}

export default function TeamSearchBar({
  teams,
  favoriteTeams,
  selectedTeam,
  onSelectTeam,
  onToggleFavorite,
}: TeamSearchBarProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get selected team name
  const selectedTeamName = teams.find(t => t.triCode === selectedTeam)?.fullName || 'Select Team';

  // Filter teams based on search query
  const filteredTeams = teams.filter(team =>
    team.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.triCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate favorites and non-favorites
  const favoritesList = filteredTeams.filter(team => favoriteTeams.includes(team.triCode));
  const nonFavoritesList = filteredTeams.filter(team => !favoriteTeams.includes(team.triCode));

  const handleSelectTeam = (triCode: string, fullName: string) => {
    onSelectTeam(triCode, fullName);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      {/* Search Bar Button */}
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="search" size={16} color={theme.subtext} />
        <Text style={styles.searchText} numberOfLines={1}>
          {selectedTeamName}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            setModalVisible(false);
            setSearchQuery('');
          }}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={16} color={theme.subtext} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search teams..."
                placeholderTextColor={theme.subtext}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.subtext} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.teamList} showsVerticalScrollIndicator={false}>
              {/* Favorites Section */}
              {favoritesList.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="star" size={12} color="#fbbf24" />
                      <Text style={styles.sectionTitle}>MY TEAMS</Text>
                    </View>
                  </View>
                  {favoritesList.map(team => (
                    <View key={team.triCode} style={styles.teamRow}>
                      <TouchableOpacity
                        style={[
                          styles.teamButton,
                          selectedTeam === team.triCode && styles.selectedTeam
                        ]}
                        onPress={() => handleSelectTeam(team.triCode, team.fullName)}
                      >
                        <Text style={styles.teamAbbrev}>{team.triCode}</Text>
                        <Text style={styles.teamName} numberOfLines={1}>{team.fullName}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.starButton}
                        onPress={() => onToggleFavorite(team.triCode, team.fullName)}
                      >
                        <Ionicons name="star" size={20} color="#fbbf24" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* All Teams Section */}
              {nonFavoritesList.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {favoritesList.length > 0 ? 'ALL TEAMS' : 'TEAMS'}
                    </Text>
                  </View>
                  {nonFavoritesList.map(team => (
                    <View key={team.triCode} style={styles.teamRow}>
                      <TouchableOpacity
                        style={[
                          styles.teamButton,
                          selectedTeam === team.triCode && styles.selectedTeam
                        ]}
                        onPress={() => handleSelectTeam(team.triCode, team.fullName)}
                      >
                        <Text style={styles.teamAbbrev}>{team.triCode}</Text>
                        <Text style={styles.teamName} numberOfLines={1}>{team.fullName}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.starButton}
                        onPress={() => onToggleFavorite(team.triCode, team.fullName)}
                      >
                        <Ionicons name="star-outline" size={20} color={theme.subtext} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* No Results */}
              {filteredTeams.length === 0 && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No teams found</Text>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalVisible(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.accent + '44',
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  chevron: {
    fontSize: 10,
    color: theme.subtext,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: theme.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accent + '44',
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    padding: 0,
  },
  clearButton: {
    fontSize: 18,
    color: theme.subtext,
    paddingHorizontal: 4,
  },
  teamList: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.subtle,
    borderBottomWidth: 1,
    borderBottomColor: theme.accent + '22',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  teamButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  selectedTeam: {
    backgroundColor: theme.accent + '22',
  },
  teamAbbrev: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.accent,
    width: 40,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  starButton: {
    padding: 12,
    paddingLeft: 8,
  },
  starFilled: {
    fontSize: 20,
    color: '#fbbf24',
  },
  starEmpty: {
    fontSize: 20,
    color: theme.subtext,
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: theme.subtext,
  },
  closeButton: {
    backgroundColor: theme.card,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
});
