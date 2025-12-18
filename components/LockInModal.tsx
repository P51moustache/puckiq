import React, { useState } from 'react';
import { Modal, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { insiderTheme } from '../constants/theme';
import { CONFIDENCE_LEVELS, ConfidenceLevel, UserWallet } from '../services/walletService';

interface LockInModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (confidenceLevel: ConfidenceLevel, isChallengingAI: boolean) => Promise<void>;
  homeTeam: string;
  awayTeam: string;
  aiPick: string;
  aiConfidence: number;
  wallet: UserWallet;
  yoloUsedToday: boolean;
  isLoading?: boolean;
}

export default function LockInModal({
  visible,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  aiPick,
  aiConfidence,
  wallet,
  yoloUsedToday,
  isLoading = false,
}: LockInModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<ConfidenceLevel>('confident');
  const [selectedTeam, setSelectedTeam] = useState<string>(aiPick);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isChallengingAI = selectedTeam !== aiPick;
  const config = CONFIDENCE_LEVELS[selectedLevel];
  const canAfford = wallet.balance >= config.cost;
  const isYoloDisabled = selectedLevel === 'yolo' && yoloUsedToday;

  // Calculate potential return with challenge bonus
  const potentialReturn = isChallengingAI
    ? Math.round(config.cost * config.multiplier * 1.5)
    : Math.round(config.cost * config.multiplier);

  const handleConfirm = async () => {
    if (!canAfford || isYoloDisabled) return;

    setIsSubmitting(true);
    try {
      await onConfirm(selectedLevel, isChallengingAI);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConfidenceOption = (level: ConfidenceLevel) => {
    const levelConfig = CONFIDENCE_LEVELS[level];
    const isSelected = selectedLevel === level;
    const isDisabled = level === 'yolo' && yoloUsedToday;
    const canAffordThis = wallet.balance >= levelConfig.cost;

    return (
      <Pressable
        key={level}
        onPress={() => !isDisabled && setSelectedLevel(level)}
        style={({ pressed }) => ({
          backgroundColor: isSelected ? `${insiderTheme.confidence.lock}22` : '#071a3699',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: 2,
          borderColor: isSelected ? insiderTheme.confidence.lock : 'transparent',
          opacity: isDisabled ? 0.4 : pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: isSelected ? insiderTheme.confidence.lock : '#e6eef8',
              }}>
                {levelConfig.label}
              </Text>
              {level === 'yolo' && (
                <View style={{
                  backgroundColor: insiderTheme.engagement.gold + '33',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <Text style={{
                    fontSize: 9,
                    fontWeight: '800',
                    color: insiderTheme.engagement.gold,
                  }}>
                    {yoloUsedToday ? 'USED TODAY' : '1/DAY'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{
              fontSize: 11,
              color: '#98a6bf',
              marginTop: 2,
            }}>
              {levelConfig.description}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '900',
              color: canAffordThis ? insiderTheme.engagement.pucks : '#ef4444',
            }}>
              {levelConfig.cost}
            </Text>
            <Text style={{
              fontSize: 10,
              color: '#98a6bf',
            }}>
              Win: {Math.round(levelConfig.cost * levelConfig.multiplier)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
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
            colors={insiderTheme.gradients.lock as [string, string, string]}
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
              LOCK IN YOUR PICK
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
                AI Pick: <Text style={{ color: insiderTheme.confidence.lock, fontWeight: '700' }}>{aiPick}</Text> ({aiConfidence}% confidence)
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
                    backgroundColor: selectedTeam === team ? `${insiderTheme.confidence.lock}22` : '#071a3699',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 2,
                    borderColor: selectedTeam === team ? insiderTheme.confidence.lock : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: selectedTeam === team ? insiderTheme.confidence.lock : '#e6eef8',
                  }}>
                    {team}
                  </Text>
                  {team === aiPick && (
                    <Text style={{
                      fontSize: 9,
                      color: insiderTheme.confidence.lock,
                      marginTop: 4,
                      fontWeight: '600',
                    }}>
                      AI PICK
                    </Text>
                  )}
                  {team !== aiPick && selectedTeam === team && (
                    <Text style={{
                      fontSize: 9,
                      color: insiderTheme.engagement.gold,
                      marginTop: 4,
                      fontWeight: '600',
                    }}>
                      CHALLENGE +50%
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Confidence Levels */}
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#98a6bf',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              How Confident Are You?
            </Text>
            {(['casual', 'confident', 'allIn', 'yolo'] as ConfidenceLevel[]).map(renderConfidenceOption)}

            {/* Summary */}
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 12,
              padding: 14,
              marginTop: 10,
              marginBottom: 20,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#98a6bf' }}>Your Balance</Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: insiderTheme.engagement.pucks,
                }}>
                  {wallet.balance} Pucks
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#98a6bf' }}>Wagering</Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: canAfford ? '#e6eef8' : '#ef4444',
                }}>
                  -{config.cost} Pucks
                </Text>
              </View>
              <View style={{
                height: 1,
                backgroundColor: '#334e8d44',
                marginVertical: 8,
              }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#98a6bf' }}>Potential Win</Text>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '900',
                  color: insiderTheme.confidence.lock,
                }}>
                  +{potentialReturn} Pucks
                  {isChallengingAI && ' 🎯'}
                </Text>
              </View>
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
                disabled={!canAfford || isYoloDisabled || isSubmitting}
                style={({ pressed }) => ({
                  flex: 2,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: (!canAfford || isYoloDisabled) ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <LinearGradient
                  colors={[insiderTheme.confidence.lock, '#059669']}
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
                      {canAfford ? 'LOCK IT IN 🔒' : 'INSUFFICIENT PUCKS'}
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
