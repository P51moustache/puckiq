import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 52) / 2; // 40px horizontal padding + 12px gap = 52px

interface TeamCardProps {
  teamName: string;
  teamAbbrev: string;
  isFavorite: boolean;
  record?: string; // e.g., "25-15-3"
  points?: number;
  conference?: string;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export default function TeamCard({
  teamName,
  teamAbbrev,
  isFavorite,
  record,
  points,
  conference,
  onPress,
  onToggleFavorite,
}: TeamCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Favorite Star */}
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.favoriteStar}>{isFavorite ? '⭐' : '☆'}</Text>
      </TouchableOpacity>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Team Logo Placeholder */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>{teamAbbrev}</Text>
        </View>

        {/* Team Name */}
        <Text style={styles.teamName} numberOfLines={2}>
          {teamName}
        </Text>

        {/* Team Info */}
        <View style={styles.infoSection}>
          {record && (
            <View style={styles.infoRow}>
              <Text style={styles.record}>{record}</Text>
              {points !== undefined && (
                <Text style={styles.points}>{points} pts</Text>
              )}
            </View>
          )}

          {conference && (
            <View style={styles.conferenceBadge}>
              <Text style={styles.conferenceText}>{conference}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.subtle,
    position: 'relative',
    height: 160,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  favoriteStar: {
    fontSize: 18,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.factbox,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: theme.accent + '44',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.accent,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
    minHeight: 32,
  },
  infoSection: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  record: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  points: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
  },
  conferenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.subtle,
  },
  conferenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
});
