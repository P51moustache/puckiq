/**
 * Rooms need an account so league-mates see the right team. Sign in with Apple only, on Apple's
 * own button; where it isn't available on this device, say rooms aren't available yet.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Card, colors } from '../coach/ui';

export function SignInCard({ ready, onSignIn }: { ready: boolean; onSignIn: () => void }) {
  if (!ready) {
    return (
      <Card style={styles.card} testID="room-signin-unavailable">
        <Text style={styles.title}>League Rooms aren’t available yet</Text>
        <Text style={styles.body}>Rooms use Sign in with Apple so league-mates see the right team, and it isn’t ready on this device yet.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.card} testID="room-signin">
      <Text style={styles.title}>Sign in to start or join a room</Text>
      <Text style={styles.body}>League-mates need to see your team: its name and roster, nothing else. Your coach moves stay private.</Text>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={26}
        style={styles.apple}
        onPress={onSignIn}
        testID="room-signin-apple"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 20, color: colors.sub },
  apple: { height: 52, marginTop: 8 },
});
