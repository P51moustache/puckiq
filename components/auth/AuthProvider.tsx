import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import AnalyticsService from '../../services/analytics/AnalyticsService';
import { createGoogleSignIn } from '../../services/googleAuth';

WebBrowser.maybeCompleteAuthSession();

const runGoogleSignIn = createGoogleSignIn({
  start: (redirectTo) => supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
  }),
  open: (url, redirectTo) => WebBrowser.openAuthSessionAsync(url, redirectTo),
  exchange: (code) => supabase.auth.exchangeCodeForSession(code),
});

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  error: string | null;
  isDeveloper: boolean;
  hasFullAccess: boolean;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const devEmails = (process.env.EXPO_PUBLIC_DEV_EMAILS || 'dev@puckiq.test')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user ?? null;

  const handleAuthChange = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const analytics = AnalyticsService.getInstance();
    if (nextSession?.user) {
      analytics.setUserId(nextSession.user.id);
      analytics.setUserProperties({
        email: nextSession.user.email || undefined,
        auth_provider: nextSession.user.app_metadata?.provider || 'unknown',
      });
    } else {
      analytics.setUserId('guest');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      handleAuthChange(data.session);
    }).catch(() => {
      if (mounted) setError('Could not restore your session. Please sign in again.');
    }).finally(() => {
      if (mounted) setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleAuthChange(nextSession);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [handleAuthChange]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return false;
    }
    return true;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(signOutError.message);
    } catch {
      setError('Could not sign out. Please try again.');
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setError(null);
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Sign-In is only available on iOS devices.');
      return false;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      if (!credential.identityToken) {
        setError('Apple Sign-In failed: missing identity token');
        return false;
      }

      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (signInError) {
        setError(signInError.message);
        return false;
      }

      return true;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') {
        setError('Apple Sign-In was cancelled.');
        return false;
      }
      setError(err?.message || 'Apple Sign-In failed');
      return false;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const redirectTo = AuthSession.makeRedirectUri({
      scheme: process.env.EXPO_PUBLIC_SCHEME || 'learningproject',
      path: 'auth/callback',
    });

    const result = await runGoogleSignIn(redirectTo);
    setError(result.error);
    return result.ok;
  }, []);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) setError(refreshError.message);
      else handleAuthChange(data.session);
    } catch {
      setError('Could not refresh your session. Please try again.');
    }
  }, [handleAuthChange]);

  const isDeveloper = useMemo(() => {
    const email = user?.email?.toLowerCase() || '';
    return devEmails.includes(email);
  }, [user?.email]);

  const contextValue = useMemo<AuthContextValue>(() => ({
    session,
    user,
    initializing,
    error,
    isDeveloper,
    hasFullAccess: isDeveloper, // Use this to bypass feature gates while building entitlements
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    refreshSession,
  }), [
    session,
    user,
    initializing,
    error,
    isDeveloper,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    refreshSession,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return value;
}
