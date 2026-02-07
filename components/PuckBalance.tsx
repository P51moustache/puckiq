import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insiderTheme } from '../constants/theme';

interface PuckBalanceProps {
  balance: number;
  onPress?: () => void;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function PuckBalance({
  balance,
  onPress,
  showLabel = true,
  size = 'medium',
}: PuckBalanceProps) {
  const isLow = balance < 100;

  const sizes = {
    small: { fontSize: 14, padding: 8, iconSize: 14 },
    medium: { fontSize: 16, padding: 10, iconSize: 16 },
    large: { fontSize: 20, padding: 12, iconSize: 20 },
  };

  const sizeConfig = sizes[size];

  const content = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isLow ? '#ef444422' : `${insiderTheme.engagement.pucks}22`,
      borderWidth: 1.5,
      borderColor: isLow ? '#ef444466' : `${insiderTheme.engagement.pucks}66`,
      borderRadius: 20,
      paddingHorizontal: sizeConfig.padding + 4,
      paddingVertical: sizeConfig.padding - 2,
      gap: 6,
    }}>
      {/* Puck Icon */}
      <Ionicons name="disc" size={sizeConfig.iconSize} color={insiderTheme.engagement.pucks} />

      <View>
        {showLabel && (
          <Text style={{
            fontSize: 9,
            fontWeight: '700',
            color: isLow ? '#ef4444' : insiderTheme.engagement.pucks,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Pucks
          </Text>
        )}
        <Text style={{
          fontSize: sizeConfig.fontSize,
          fontWeight: '900',
          color: isLow ? '#ef4444' : insiderTheme.engagement.pucks,
        }}>
          {balance.toLocaleString()}
        </Text>
      </View>

      {isLow && (
        <View style={{
          backgroundColor: '#ef4444',
          borderRadius: 10,
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 2,
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '900',
            color: '#fff',
          }}>
            !
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
}
