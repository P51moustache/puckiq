import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../constants/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { session, initializing, signUpWithEmail, signInWithApple, signInWithGoogle, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initializing && session) {
      // Navigate to main app after successful sign-up
      router.replace('/(tabs)');
    }
  }, [initializing, session, router]);

  const handleEmailSignUp = async () => {
    if (!email || password.length < 8) return;
    setLoading(true);
    await signUpWithEmail(email.trim(), password);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  const handleApple = async () => {
    setLoading(true);
    await signInWithApple();
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.card}>
          <ThemedText type="title" style={styles.title}>Create account</ThemedText>
          <ThemedText style={styles.subtitle}>Save your picks, streaks, and preferences across devices.</ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={theme.subtext}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Password (min 8 chars)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleEmailSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Sign up</ThemedText>}
          </TouchableOpacity>

          <ThemedText style={styles.dividerLabel}>or</ThemedText>

          <TouchableOpacity style={[styles.button, styles.appleButton]} onPress={handleApple} disabled={loading}>
            <ThemedText style={styles.buttonText}>Continue with Apple</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={handleGoogle} disabled={loading}>
            <ThemedText style={styles.buttonText}>Continue with Google</ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText>Already have an account? </ThemedText>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <ThemedText type="link">Sign in</ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1021',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#11182f',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#1e2b4a',
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    color: theme.subtext,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    color: theme.subtext,
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2b4a',
    backgroundColor: '#0c1328',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    marginTop: 8,
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#222',
  },
  googleButton: {
    backgroundColor: '#19253d',
    borderColor: '#23355a',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  dividerLabel: {
    textAlign: 'center',
    color: theme.subtext,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
});
