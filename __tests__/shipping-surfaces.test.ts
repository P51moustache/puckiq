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

  it('opens Lines with no native SDK on the launch path', () => {
    const rootLayout = fs.readFileSync(path.join(repoRoot, 'app/_layout.tsx'), 'utf8');
    expect(rootLayout).not.toMatch(/react-native-purchases/);
    expect(rootLayout).not.toMatch(/SubscriptionProvider/);
    expect(rootLayout).not.toMatch(/initializeNotifications/);
    expect(rootLayout).not.toMatch(/OnboardingFlow/);
    expect(rootLayout).not.toMatch(/AuthProvider/);
    expect(rootLayout).not.toMatch(/AnalyticsProvider/);
    expect(rootLayout).toMatch(/Stack\.Screen name="\(tabs\)"/);

    const subscription = fs.readFileSync(path.join(repoRoot, 'services/subscription.ts'), 'utf8');
    expect(subscription).not.toMatch(/from ['"]react-native-purchases['"]/);
    expect(subscription).not.toMatch(/Purchases\.configure/);
  });

  it('lets the first name be typed on Lines without a Notes workaround', () => {
    const lines = fs.readFileSync(path.join(repoRoot, 'components/ThisWeekLinesScreen.tsx'), 'utf8');
    expect(lines).toMatch(/lines-name-input/);
    expect(lines).toMatch(/addName/);
    expect(lines).not.toMatch(/Lock of the Day/);
    expect(lines).not.toMatch(/searchNhlPlayers/);
  });
});
