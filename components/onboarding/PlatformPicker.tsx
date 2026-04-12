import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

type PlatformChoice = 'yahoo' | 'espn' | 'browsing';

interface PlatformPickerProps {
  onSelect: (choice: PlatformChoice) => void;
}

const PLATFORMS: { id: 'yahoo' | 'espn'; label: string; accent: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { id: 'yahoo', label: 'Yahoo Fantasy', accent: '#7c3aed', icon: 'american-football', desc: 'Sync your Yahoo league' },
  { id: 'espn', label: 'ESPN Fantasy', accent: '#dc2626', icon: 'trophy', desc: 'Sync your ESPN league' },
];

export function PlatformPicker({ onSelect }: PlatformPickerProps) {
  const [selected, setSelected] = useState<PlatformChoice | null>(null);

  const handleSelect = (choice: PlatformChoice) => {
    setSelected(choice);
    // Small delay so the user sees the selection highlight
    setTimeout(() => onSelect(choice), 300);
  };

  return (
    <LinearGradient
      colors={['#0f172a', '#1e3a8a', '#071023']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.title}>
          What platform do{'\n'}you play on?
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(500).delay(150)} style={styles.subtitle}>
          We'll tailor your experience
        </Animated.Text>
      </View>

      <View style={styles.cards}>
        {PLATFORMS.map((platform, index) => {
          const isSelected = selected === platform.id;
          return (
            <Animated.View
              key={platform.id}
              entering={FadeInDown.duration(500).delay(300 + index * 150)}
            >
              <TouchableOpacity
                style={[
                  styles.card,
                  isSelected && {
                    borderColor: platform.accent,
                    shadowColor: platform.accent,
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 12,
                  },
                ]}
                onPress={() => handleSelect(platform.id)}
                accessibilityLabel={platform.label}
                activeOpacity={0.7}
              >
                <View style={[styles.accentStripe, { backgroundColor: platform.accent }]} />
                <View style={styles.cardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: `${platform.accent}20` }]}>
                    <Ionicons name={platform.icon} size={24} color={platform.accent} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardLabel, isSelected && { color: '#ffffff' }]}>
                      {platform.label}
                    </Text>
                    <Text style={styles.cardDesc}>{platform.desc}</Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: platform.accent }]}>
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={FadeInDown.duration(500).delay(700)} style={styles.skipContainer}>
        <TouchableOpacity onPress={() => handleSelect('browsing')} activeOpacity={0.6}>
          <Text style={styles.skipText}>Skip — just browsing</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#98a6bf',
    marginTop: 8,
  },
  cards: {
    gap: 16,
  },
  card: {
    backgroundColor: '#192e5e',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2a4080',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingLeft: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e6eef8',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 14,
    color: '#98a6bf',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  skipText: {
    color: '#98a6bf',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
