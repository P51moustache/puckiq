import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BARN_NAME, barn, barnLines } from '../constants/barn';
import { LIST_PRICE } from '../constants/monetization';
import { useAuthContext } from './auth/AuthProvider';
import PageHeader from './PageHeader';
import RinkMarkings from './RinkMarkings';

export default function HubScreen() {
  const { user, signInWithApple, signInWithGoogle, signOut } = useAuthContext();

  return (
    <View style={s.container}>
      <RinkMarkings />
      <PageHeader title="Settings" subtitle={BARN_NAME} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={s.hero}>THIS</Text>
          <Text style={s.hero}>DEVICE</Text>
          <View style={s.centerIce} />
        </View>

        <View style={s.section} testID="plan-section">
          <Text style={s.sectionTitle}>THE BOARD</Text>
          <Text style={s.planTier} testID="plan-tier">
            Paid · {LIST_PRICE}
          </Text>
          <Text style={s.planCopy}>
            This week's lines. Last week's tape. F, D, G, the bench. Local. This device.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>YOU</Text>
          {user ? (
            <View style={s.accountRow}>
              <View style={s.accountInfo}>
                <Text style={s.emailText} numberOfLines={1}>{user.email}</Text>
                <Text style={s.accountStatus}>ON THE BOARD</Text>
              </View>
              <Pressable
                style={s.signOutButton}
                onPress={signOut}
                testID="sign-out-button"
              >
                <Text style={s.signOutText}>Leave</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.authButtons}>
              <Pressable
                style={s.authButton}
                onPress={signInWithApple}
                testID="sign-in-apple"
              >
                <Ionicons name="logo-apple" size={18} color={barn.ink} style={s.authIcon} />
                <Text style={s.authButtonText}>Apple</Text>
              </Pressable>
              <Pressable
                style={s.ghostButton}
                onPress={signInWithGoogle}
                testID="sign-in-google"
              >
                <Ionicons name="logo-google" size={16} color={barn.ink} style={s.authIcon} />
                <Text style={s.ghostButtonText}>Google</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={s.aboutRow}>
          <View style={s.aboutLeft}>
            <Text style={s.aboutLabel}>TAPE</Text>
            <Text style={s.aboutValue}>2.3.0</Text>
          </View>
          <Pressable style={s.supportLink} testID="support-link">
            <Text style={s.supportLinkText}>Support</Text>
          </Pressable>
        </View>

        <Text style={s.footerLine}>{barnLines.home}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: barn.ground,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  heroBlock: {
    marginTop: 12,
    marginBottom: 40,
  },
  hero: {
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  centerIce: {
    marginTop: 20,
    height: 4,
    width: 88,
    backgroundColor: barn.signal,
    shadowColor: barn.signal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  emailText: {
    fontSize: 16,
    color: barn.ink,
    fontFamily: barn.fonts.body,
    flexShrink: 1,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  signOutText: {
    color: barn.ghost,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.4,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  authButtons: {
    gap: 10,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: barn.signal,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: barn.ink,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  accountInfo: {
    flex: 1,
  },
  accountStatus: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: barn.ghost,
    marginTop: 4,
    fontFamily: barn.fonts.mono,
    fontWeight: '700',
  },
  planTier: {
    fontSize: 31,
    lineHeight: 32,
    fontWeight: '800',
    fontFamily: barn.fonts.display,
    color: barn.ink,
    marginBottom: 12,
  },
  planCopy: {
    fontSize: 16,
    lineHeight: 24,
    color: barn.ink,
    fontFamily: barn.fonts.body,
  },
  authIcon: {
    marginRight: 10,
  },
  authButtonText: {
    color: barn.ink,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.6,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  ghostButtonText: {
    color: barn.ink,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.6,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: barn.ghost,
    letterSpacing: 3,
    fontFamily: barn.fonts.mono,
    marginBottom: 12,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: barn.rule,
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  aboutLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
  },
  aboutValue: {
    fontSize: 16,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    fontWeight: '800',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportLinkText: {
    color: barn.ghost,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.4,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
  footerLine: {
    marginTop: 32,
    fontSize: 12,
    letterSpacing: 1.6,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
  },
});
