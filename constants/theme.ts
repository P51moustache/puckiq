import { Platform, StyleSheet } from 'react-native';

const selectFont = (options: { ios: string; android: string; default: string }): string => {
  try {
    return Platform.select?.(options) ?? options.default;
  } catch {
    return options.default;
  }
};

// Stat Sheet Theme — single dark surface, cyan accent, semantic green/red/amber
// Legacy `theme.*` keys preserved for backwards compatibility, but their VALUES
// now align with the rinkGlass palette so the whole app reads as one surface.
export const theme = {
  background: '#0a0e1a',      // → rinkGlass.ice
  card: '#141829',            // → rinkGlass.boards (was navy #192e5e — caused the blue panels in Explore)
  factbox: '#1c2038',         // → rinkGlass.zamboni (was bright navy #334e8d — caused saturated blue stat boxes)
  text: '#f0f4ff',            // → rinkGlass.textPrimary
  subtext: '#8b95b0',         // → rinkGlass.textSecondary
  accent: '#4cc9f0',          // → rinkGlass.blueLight (was #60a5fa)
  subtle: '#0f1424',          // (was #071a36)
  modalBorder: 'rgba(255,255,255,0.10)', // (was #081726)
  modalBg: '#141829',         // → rinkGlass.boards
  pressed: '#1c2038',         // → rinkGlass.zamboni

  colors: {
    primary: '#4cc9f0',
    primaryDark: '#1c2038',
    secondary: '#1c2038',

    background: '#0a0e1a',
    surface: '#141829',
    elevated: '#1c2038',

    textPrimary: '#f0f4ff',
    textSecondary: '#8b95b0',

    hover: '#1c2038',
    border: 'rgba(255,255,255,0.10)',
  },
  
  // Typography scale for professional consistency
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 32,
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  // Spacing system (8pt grid)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // Semantic data colors
  semantic: {
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#fbbf24',
    info: '#60a5fa',
  },

  // Elevation levels
  elevation: {
    low: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    medium: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    high: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
    glow: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  },

  // Glassmorphism tokens
  glass: {
    bg: 'rgba(255, 255, 255, 0.08)',
    bgHover: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.15)',
    borderBright: 'rgba(255, 255, 255, 0.25)',
    blur: 60,
  },

  // Font tokens
  fonts: {
    mono: selectFont({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    system: selectFont({ ios: 'System', android: 'Roboto', default: 'System' }),
  },

  // Animation timing tokens
  animation: {
    spring: { damping: 15, stiffness: 150 },
    entryDuration: 400,
    staggerDelay: 80,
    flashDuration: 600,
  },
};

// Pre-built text style presets for consistent typography
export const textStyles = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 32,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    lineHeight: 26,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.text,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.subtext,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.subtext,
    lineHeight: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
});

export const getTheme = () => theme;

export const makeStyles = () => {
  const t = getTheme();
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      paddingTop: Platform.OS === 'ios' ? 60 : 30,
      alignItems: 'center',
    },
    scrollContainer: {
      paddingBottom: 40,
      width: '100%',
    },
    header: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 18,
    },
    spacer: {
      margin: 10
    },
    mainpic: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.subtle,
      marginBottom: 0,
      marginTop: 20,
      backgroundColor: t.subtle,
    },
    title: {
      fontSize: 36,
      fontWeight: '700',
      color: t.text,
      fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
      alignSelf: 'flex-start',
    },
    subsection: {
      fontSize: 24,
      fontWeight: '700',
      color: t.text,
      fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
      alignSelf: 'flex-start',
      flexDirection: 'row',
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
      alignItems: 'stretch',
      marginTop: 14,
    },
    factbox: {
      backgroundColor: t.factbox,
      padding: 8,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'center',
      justifyContent: 'space-evenly',
      minHeight: 80,
      marginHorizontal: 2,
    },
    factboxOne: {
      backgroundColor: t.factbox,
  paddingVertical: 15,
  paddingHorizontal: 18,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      marginTop: 8,
  marginBottom: 10,
      marginHorizontal: 2,
      width: '100%',
      flexShrink: 1,
    },
    factboxTwo: {
      backgroundColor: t.factbox,
      padding: 8,
      paddingTop: 12,
      paddingBottom: 12,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'center',
      justifyContent: 'center',
      height: 100,
      marginHorizontal: 2,
      width: '47%',
      gap: 4,
    },
    factboxThree: {
      backgroundColor: t.factbox,
      padding: 8,
      paddingTop: 12,
      paddingBottom: 12,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'center',
      justifyContent: 'center',
      height: 100,
      marginHorizontal: 2,
      width: '30%',
      gap: 4,
    },
    boxtitle: {
      fontSize: 14,
      color: t.text,
      fontWeight: '500',
      alignSelf: 'center',
      textAlign: 'center',
    },
    boxvalue: {
      fontSize: 18,
      color: t.text,
      fontWeight: '800',
      alignSelf: 'center',
      textAlign: 'center',
    },
    factboxrow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      marginTop: 8,
      marginBottom: 16,
      width: '100%',
      backgroundColor: 'transparent',
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
    subtext: {
      color: t.subtext,
      fontSize: 13,
      fontWeight: '400',
    },
    subtextSmall: {
      color: t.subtext,
      fontSize: 10,
      fontWeight: '400',
      textAlign: 'center',
    },
    subtextCentered: {
      color: t.subtext,
      fontSize: 12,
      fontWeight: '400',
      textAlign: 'center',
    },
    subtextLarge: {
      color: t.subtext,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
      backgroundColor: t.modalBg,
      borderRadius: 12,
      padding: 20,
      margin: 20,
      maxWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
      color: t.text,
    },
    modalText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      color: t.subtext,
    },
    modalButton: {
      backgroundColor: t.pressed,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignSelf: 'flex-end',
    },
    modalButtonText: {
      color: t.text,
      fontWeight: '500',
    },
    infoIconButton: {
      marginLeft: 8,
      padding: 4,
    },
    playerCard: {
      width: '100%',
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.subtle,
    },
  });
};

export const tokens = {
  get: getTheme,
};

// Pick styling for engagement features
export const pickTheme = {
  // Card styling (removed classified/spy theme)
  card: {
    background: '#1a0a2e',
    border: '#7c3aed',
    text: '#a78bfa',
    highlight: '#60a5fa',
  },

  // Confidence colors - renamed for clarity
  confidence: {
    topPick: '#10b981',    // Top Pick - highest confidence
    solid: '#3b82f6',      // Solid pick
    good: '#f59e0b',       // Good pick
    tossUp: '#ef4444',     // Toss-up
  },

  // Engagement/gamification colors
  engagement: {
    gold: '#fbbf24',
    fire: '#f97316',
    streak: '#ef4444',
    xp: '#a78bfa',
    pucks: '#60a5fa',
  },

  // Gradients for premium cards
  gradients: {
    topPick: ['#7c3aed', '#3b82f6', '#ec4899'],
    card: ['#1e1b4b', '#312e81'],
    celebration: ['#fbbf24', '#f59e0b'],
  },
};

// Rink Glass Design System — "looking through arena glass during a night game"
export const rinkGlass = {
  // Backgrounds
  ice: '#0a0e1a',
  glass: 'rgba(255, 255, 255, 0.06)',
  boards: '#141829',
  zamboni: '#1c2038',

  // Accent colors
  blueLight: '#4cc9f0',
  goalLight: '#f72585',
  powerPlay: '#ffd60a',
  faceoffDot: '#06d6a0',
  redLine: '#e63946',

  // Text colors
  textPrimary: '#f0f4ff',
  textSecondary: '#8b95b0',
  textMuted: '#525c75',

  // Glass card tokens
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassHighlight: 'rgba(255, 255, 255, 0.04)',
  cardGlow: 'rgba(76, 201, 240, 0.15)',

  // Module accent map
  moduleAccents: {
    // Stat Sheet vision: a single cyan underline for every module header so
    // sections feel like part of the same publication. Semantic colors stay
    // reserved for data direction (green positive, red negative, amber warn) —
    // not for section decoration.
    startSit: '#4cc9f0',
    trending: '#4cc9f0',
    alerts: '#4cc9f0',
    waiverWire: '#4cc9f0',
    matchupEdge: '#4cc9f0',
    dailyInsight: '#4cc9f0',
  },

  // Card press animation values
  pressScale: 0.98,
  pressShadow: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowColor: '#000',
  },

  // Font tokens
  fonts: {
    display: 'Display-Bold',  // Oswald Bold — condensed, sporty headlines
    body: selectFont({ ios: 'System', android: 'Roboto', default: 'System' }),
    mono: selectFont({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
};

// Backwards compatibility alias (deprecated - use pickTheme instead)
// Maps old property names to new ones for existing components
export const insiderTheme = {
  ...pickTheme,
  // Old 'classified' section mapped to 'card'
  classified: {
    background: pickTheme.card.background,
    border: pickTheme.card.border,
    text: pickTheme.card.text,
    stamp: '#ef4444', // Keep for backwards compat
  },
  // Old confidence names mapped to new ones
  confidence: {
    ...pickTheme.confidence,
    lock: pickTheme.confidence.topPick,
    strong: pickTheme.confidence.solid,
    moderate: pickTheme.confidence.good,
  },
  // Old gradient names
  gradients: {
    ...pickTheme.gradients,
    lock: pickTheme.gradients.topPick,
    insider: pickTheme.gradients.card,
  },
};
