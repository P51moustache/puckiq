import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { LIST_PRICE } from '../constants/monetization';
import { useAuthContext } from './auth/AuthProvider';
import PageHeader from './PageHeader';

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderLeft}>
        <Ionicons name={icon} size={18} color={rinkGlass.blueLight} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={[rinkGlass.blueLight, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.sectionLine}
      />
    </View>
  );
}

export default function HubScreen() {
  const { user, signInWithApple, signInWithGoogle, signOut } = useAuthContext();

  return (
    <View style={s.container}>
      <PageHeader title="Settings" subtitle="Your roster · this device" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.section} testID="plan-section">
          <SectionHeader icon="disc-outline" title="PuckIQ" />
          <View style={s.card}>
            <Text style={s.planTier} testID="plan-tier">
              Paid app · {LIST_PRICE}
            </Text>
            <Text style={s.planCopy}>
              One coach tool for YOUR roster. This week’s lines, copy last week, tap F / D / G / bench. Local on this device — no Pro gate, no extra teams.
            </Text>
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader icon="person-outline" title="Account" />
          <View style={s.card}>
            {user ? (
              <View style={s.accountRow}>
                <View style={s.accountInfo}>
                  <Text style={s.emailText} numberOfLines={1}>{user.email}</Text>
                  <Text style={s.accountStatus}>SIGNED IN</Text>
                </View>
                <Pressable
                  style={s.signOutButton}
                  onPress={signOut}
                  testID="sign-out-button"
                >
                  <Text style={s.signOutText}>Sign out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.authButtons}>
                <Pressable
                  style={s.authButton}
                  onPress={signInWithApple}
                  testID="sign-in-apple"
                >
                  <Ionicons name="logo-apple" size={18} color={rinkGlass.textPrimary} style={s.authIcon} />
                  <Text style={s.authButtonText}>Continue with Apple</Text>
                </Pressable>
                <Pressable
                  style={s.authButton}
                  onPress={signInWithGoogle}
                  testID="sign-in-google"
                >
                  <Ionicons name="logo-google" size={16} color={rinkGlass.textPrimary} style={s.authIcon} />
                  <Text style={s.authButtonText}>Continue with Google</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={s.aboutRow}>
          <View style={s.aboutLeft}>
            <Text style={s.aboutLabel}>VERSION</Text>
            <Text style={s.aboutValue}>2.3.0</Text>
          </View>
          <Pressable style={s.supportLink} testID="support-link">
            <Text style={s.supportLinkText}>Support</Text>
            <Ionicons name="open-outline" size={12} color={rinkGlass.blueLight} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emailText: {
    fontSize: 15,
    color: rinkGlass.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  signOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  signOutText: {
    color: rinkGlass.textSecondary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  authButtons: {
    gap: 8,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rinkGlass.zamboni,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
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
    fontSize: 9,
    letterSpacing: 1.5,
    color: rinkGlass.faceoffDot,
    marginTop: 2,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
  },
  planTier: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    marginBottom: 8,
  },
  planCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: rinkGlass.textSecondary,
  },
  authIcon: {
    marginRight: 10,
  },
  authButtonText: {
    color: rinkGlass.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    letterSpacing: 0.2,
    fontFamily: rinkGlass.fonts.display,
  },
  sectionLine: {
    height: 1,
    borderRadius: 1,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(42, 64, 128, 0.4)',
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutLabel: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  aboutValue: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
    fontWeight: '500',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportLinkText: {
    color: rinkGlass.blueLight,
    fontWeight: '600',
    fontSize: 13,
  },
});
