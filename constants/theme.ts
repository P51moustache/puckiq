import { Platform, StyleSheet } from 'react-native';

// Dark Mode Hockey Theme
export const theme = {
  // Original colors that work with your dark mode app
  background: '#071023',
  card: '#192e5eff',
  factbox: '#334e8dff',
  text: '#e6eef8',
  subtext: '#98a6bf',
  accent: '#60a5fa',
  subtle: '#071a36',
  modalBorder: '#081726',
  modalBg: '#192e5eff',
  pressed: '#0e223f',
  
  // Professional additions while keeping your working colors
  colors: {
    // Your existing colors but organized
    primary: '#60a5fa', // Your accent color
    primaryDark: '#334e8dff',
    secondary: '#334e8dff', // Your factbox color
    
    // Backgrounds
    background: '#071023',
    surface: '#192e5eff', // Your card color
    elevated: '#334e8dff', // Your factbox color
    
    // Text
    textPrimary: '#e6eef8', // Your text color
    textSecondary: '#98a6bf', // Your subtext color
    
    // Interactive
    hover: '#0e223f',
    border: '#081726',
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
};

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
      alignItems: 'center',
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
      width: '47%',
    },
    factboxThree: {
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
      width: '30%',
    },
    boxtitle: {
      fontSize: 14,
      color: t.text,
      fontWeight: '500',
  alignSelf: 'center',
  textAlign: 'center',
      justifyContent: 'flex-start',
    },
    boxvalue: {
      fontSize: 18,
      color: t.text,
      fontWeight: '800',
      alignSelf: 'center',
      textAlign: 'center',
      marginTop: 4,
    },
    factboxrow: {
      flexDirection: 'row', 
      justifyContent: 'space-between', 
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
