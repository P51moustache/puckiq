import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const tabsDir = path.join(repoRoot, 'app/(tabs)');

const SHIPPED_TAB_FILES = new Set(['_layout.tsx', 'index.tsx', 'myteam.tsx', 'hub.tsx']);
const KILLED_ROUTES = ['news', 'league', 'players', 'stats', 'models', 'teams'];

describe('Week 1 shipping surfaces', () => {
  it('registers only Lines / Roster / Settings — no leftover tab or href:null routes', () => {
    const layout = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/title: 'Lines'/);
    expect(layout).toMatch(/title: 'Roster'/);
    expect(layout).toMatch(/title: 'Settings'/);
    expect(layout).not.toMatch(/href:\s*null/);
    expect(layout).not.toMatch(/title: 'Tonight'/);
    expect(layout).not.toMatch(/title: 'News'/);
    expect(layout).not.toMatch(/title: 'League'/);
    for (const name of KILLED_ROUTES) {
      expect(layout).not.toMatch(new RegExp(`name=["']${name}["']`));
    }
  });

  it('does not keep pick-edge route files that Expo Router can deep-link', () => {
    const files = fs.readdirSync(tabsDir).filter((name) => !name.startsWith('.'));
    expect(files.sort()).toEqual([...SHIPPED_TAB_FILES].sort());
    for (const name of KILLED_ROUTES) {
      expect(fs.existsSync(path.join(tabsDir, `${name}.tsx`))).toBe(false);
      expect(fs.existsSync(path.join(tabsDir, `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(tabsDir, `${name}.jsx`))).toBe(false);
    }
  });

  it('opens the Lines tab on ThisWeekLinesScreen', () => {
    const home = fs.readFileSync(path.join(tabsDir, 'index.tsx'), 'utf8');
    expect(home).toMatch(/ThisWeekLinesScreen/);
    expect(home).not.toMatch(/TonightRosterScreen/);
    expect(home).not.toMatch(/LockOfTheDay/);
  });

  it('does not ship AdMob, IAP paywall chrome, or a Pro subscribe control on Settings', () => {
    const hub = fs.readFileSync(path.join(repoRoot, 'components/HubScreen.tsx'), 'utf8');
    expect(hub).not.toMatch(/settings-subscribe/);
    expect(hub).not.toMatch(/ProPaywall/);
    expect(hub).toMatch(/LIST_PRICE/);
    expect(hub).not.toMatch(/Lock of the Day/);

    const monetization = fs.readFileSync(path.join(repoRoot, 'constants/monetization.ts'), 'utf8');
    expect(monetization).toMatch(/\$1\.99/);
    expect(monetization).toMatch(/EXPO_PUBLIC_PAYWALL_ENABLED === '1'/);

    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies['react-native-google-mobile-ads']).toBeUndefined();
    expect(pkg.dependencies['react-native-purchases']).toBeUndefined();
    expect(pkg.version).toBe('2.3.0');
  });

  it('opens Lines without RevenueCat, onboarding, or pick-notifications on the launch path', () => {
    const root = fs.readFileSync(path.join(repoRoot, 'app/_layout.tsx'), 'utf8');
    expect(root).toMatch(/name="\(tabs\)"/);
    expect(root).not.toMatch(/OnboardingFlow/);
    expect(root).not.toMatch(/initializeNotifications/);
    expect(root).not.toMatch(/react-native-purchases/);
    expect(root).not.toMatch(/initializeSubscription/);
    expect(root).not.toMatch(/Lock of the Day/);

    const subscription = fs.readFileSync(path.join(repoRoot, 'services/subscription.ts'), 'utf8');
    expect(subscription).not.toMatch(/react-native-purchases/);
    expect(subscription).not.toMatch(/from ['"]react-native-purchases['"]/);
    expect(subscription).not.toMatch(/Purchases\./);

    const provider = fs.readFileSync(path.join(repoRoot, 'components/SubscriptionProvider.tsx'), 'utf8');
    expect(provider).not.toMatch(/initializeSubscription/);
    expect(provider).not.toMatch(/isPro/);

    const supabase = fs.readFileSync(path.join(repoRoot, 'lib/supabase.ts'), 'utf8');
    expect(supabase).not.toMatch(/throw new Error/);
  });
});
