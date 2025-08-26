import { Platform, StyleSheet } from 'react-native';

export const themes = {
  light: {
    background: '#f6f8fb',
    card: '#ffffff',
    text: '#0f172a',
    subtext: '#64748b',
    accent: '#2563eb',
    subtle: '#e6eefb',
    modalBorder: '#e2e8f0',
    modalBg: '#fff',
    pressed: '#f8fafc',
  },
  dark: {
    background: '#071023',
    card: '#192e5eff',
    text: '#e6eef8',
    subtext: '#98a6bf',
    accent: '#60a5fa',
    subtle: '#071a36',
    modalBorder: '#081726',
    modalBg: '#192e5eff',
    pressed: '#0e223f',
  },
};

export type Scheme = 'light' | 'dark';
export const getTheme = (scheme: Scheme = 'light') => (scheme === 'dark' ? themes.dark : themes.light);

export const makeStyles = (scheme: Scheme = 'light') => {
  const t = getTheme(scheme);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      paddingTop: Platform.OS === 'ios' ? 60 : 30,
      alignItems: 'center',
    },
    scrollContainer: {
      alignItems: 'center',
      paddingBottom: 40,
      paddingHorizontal: 16,
      width: '100%',
    },
    header: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 18,
    },
    mainpic: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.subtle,
      marginBottom: 8,
      marginTop: 12,
      backgroundColor: t.subtle,
    },
    title: {
      fontSize: 36,
      fontWeight: '700',
      color: t.text,
      fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
      alignSelf: 'flex-start',
    },
    subtitle: {
      fontSize: 13,
      color: t.subtext,
      marginTop: 4,
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: t.card,
      padding: 15,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'center',
    },
    greeting: {
      fontSize: 18,
      color: t.text,
      marginBottom: 8,
      fontWeight: '600',
      alignSelf: 'center',
    },
    nameAccent: {
      color: t.accent,
      fontWeight: '800',
    },
    lead: {
      color: t.subtext,
      marginBottom: 12,
      fontSize: 13,
    },
    cta: {
      marginTop: 8,
      backgroundColor: t.accent,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    ctaText: {
      color: '#fff',
      fontWeight: '700',
    },
    countdownBox: {
      alignSelf: 'stretch',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 0,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    countdownLabel: {
      color: '#ffffffcc',
      textAlign: 'center',
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 2,
      fontWeight: '700',
    },
    countdownTimer: {
      color: '#fff',
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '800',
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    },
  });
};

export const tokens = {
  get: getTheme,
};
