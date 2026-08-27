import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { LIST_PRICE } from '../constants/monetization';
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

        <View style={s.section} testID="device-section">
          <SectionHeader icon="phone-portrait-outline" title="This device" />
          <View style={s.card}>
            <Text style={s.planCopy}>
              Lines stay on this phone. No account, no iCloud, no extra team.
            </Text>
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
