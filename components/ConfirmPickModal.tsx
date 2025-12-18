import React, { useState } from 'react';
import { Modal, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { pickTheme } from '../constants/theme';

interface ConfirmPickModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedTeam: string) => Promise<void>;
  homeTeam: string;
  awayTeam: string;
  aiPick: string;
  aiConfidence: number;
}

export default function ConfirmPickModal({
  visible,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  aiPick,
  aiConfidence,
}: ConfirmPickModalProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>(aiPick);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(selectedTeam);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          backgroundColor: '#0a1628',
          borderRadius: 20,
          width: '100%',
          maxWidth: 380,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <LinearGradient
            colors={pickTheme.gradients.topPick as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <Text style={{
              fontSize: 20,
              fontWeight: '900',
              color: '#fff',
              textAlign: 'center',
              letterSpacing: 1,
            }}>
              CONFIRM YOUR PICK
            </Text>
          </LinearGradient>

          <View style={{ padding: 20 }}>
            {/* Matchup */}
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 22,
                fontWeight: '800',
                color: '#e6eef8',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                {awayTeam} @ {homeTeam}
              </Text>
              <Text style={{
                fontSize: 12,
                color: '#98a6bf',
                textAlign: 'center',
              }}>
                AI Pick: <Text style={{ color: pickTheme.confidence.bestBet, fontWeight: '700' }}>{aiPick}</Text> ({aiConfidence}% confidence)
              </Text>
            </View>

            {/* Team Selection */}
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#98a6bf',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              Your Pick
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {[awayTeam, homeTeam].map((team) => (
                <Pressable
                  key={team}
                  onPress={() => setSelectedTeam(team)}
                  style={{
                    flex: 1,
                    backgroundColor: selectedTeam === team ? `${pickTheme.confidence.bestBet}22` : '#071a3699',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 2,
                    borderColor: selectedTeam === team ? pickTheme.confidence.bestBet : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: selectedTeam === team ? pickTheme.confidence.bestBet : '#e6eef8',
                  }}>
                    {team}
                  </Text>
                  {team === aiPick && (
                    <Text style={{
                      fontSize: 9,
                      color: pickTheme.confidence.bestBet,
                      marginTop: 4,
                      fontWeight: '600',
                    }}>
                      AI PICK
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  backgroundColor: '#334e8d44',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#98a6bf',
                }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={isSubmitting}
                style={({ pressed }) => ({
                  flex: 2,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <LinearGradient
                  colors={[pickTheme.confidence.bestBet, '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '900',
                      color: '#fff',
                      letterSpacing: 0.5,
                    }}>
                      CONFIRM PICK
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
