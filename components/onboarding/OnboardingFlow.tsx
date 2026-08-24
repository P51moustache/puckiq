import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { WelcomeScreen } from './WelcomeScreen';
import { RosterSetup } from './RosterSetup';
import { saveRoster } from '../../services/fantasyRoster';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSignInWithApple: () => Promise<boolean>;
  onSignInWithGoogle: () => Promise<boolean>;
}

export function OnboardingFlow({
  onComplete,
  onSignInWithApple,
  onSignInWithGoogle,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(1);

  const goToStep = useCallback((nextStep: number) => {
    setStep(nextStep);
  }, []);

  // Screen 1 handlers
  const handleApple = useCallback(async () => {
    await onSignInWithApple();
    goToStep(2);
  }, [onSignInWithApple, goToStep]);

  const handleGoogle = useCallback(async () => {
    await onSignInWithGoogle();
    goToStep(2);
  }, [onSignInWithGoogle, goToStep]);

  const handleSkipAuth = useCallback(() => {
    goToStep(2);
  }, [goToStep]);

  const handleRosterContinue = useCallback(async (players: { id: number; name: string; teamAbbrev: string; position: string }[]) => {
    try {
      await saveRoster({
        name: 'My Team',
        scoringFormat: 'yahoo',
        players: players.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          teamAbbrev: p.teamAbbrev,
          position: p.position,
          rosterPosition: 'BN' as const,
        })),
      });
    } catch (err) {
      console.warn('[ONBOARDING] Failed to save roster players:', err);
    }
    onComplete();
  }, [onComplete]);

  const handleRosterSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const renderScreen = () => {
    switch (step) {
      case 1:
        return (
          <Animated.View
            key="welcome"
            entering={FadeIn.duration(400)}
            exiting={SlideOutLeft.duration(300)}
            style={styles.screen}
          >
            <WelcomeScreen
              onContinueWithApple={handleApple}
              onContinueWithGoogle={handleGoogle}
              onSkip={handleSkipAuth}
            />
          </Animated.View>
        );
      case 2:
        return (
          <Animated.View
            key="roster"
            entering={SlideInRight.duration(350)}
            exiting={SlideOutLeft.duration(300)}
            style={styles.screen}
          >
            <RosterSetup onContinue={handleRosterContinue} onSkip={handleRosterSkip} />
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}

      {/* Step indicator dots */}
      <View style={styles.dots}>
        {[1, 2].map((s) => (
          <Animated.View
            key={s}
            style={[
              styles.dot,
              s === step && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071023',
  },
  screen: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 20,
    backgroundColor: '#071023',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  dotActive: {
    backgroundColor: '#60a5fa',
    width: 28,
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
});
