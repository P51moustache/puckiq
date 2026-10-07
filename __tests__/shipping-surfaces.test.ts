import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const tabsDir = path.join(repoRoot, 'app/(tabs)');

const SHIPPED_TAB_FILES = ['_layout.tsx', 'hub.tsx', 'index.tsx', 'myteam.tsx', 'pickups.tsx', 'week.tsx'];
const KILLED_ROUTES = ['news', 'league', 'players', 'stats', 'models', 'teams'];

describe('PuckIQ 3 shipping surfaces', () => {
  it('registers Tonight / Week / Pickups / Roster / Settings and nothing else', () => {
    const layout = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf8');
    for (const title of ['Tonight', 'Week', 'Pickups', 'Roster', 'Settings']) {
      expect(layout).toMatch(new RegExp(`title: '${title}'`));
    }
    expect(layout).not.toMatch(/href:\s*null/);
    for (const name of KILLED_ROUTES) {
      expect(layout).not.toMatch(new RegExp(`name=["']${name}["']`));
    }
  });

  it('does not keep pick-edge route files that Expo Router can deep-link', () => {
    const files = fs.readdirSync(tabsDir).filter((name) => !name.startsWith('.') && name !== '__tests__');
    expect(files.sort()).toEqual([...SHIPPED_TAB_FILES].sort());
  });

  it('opens on Tonight', () => {
    const home = fs.readFileSync(path.join(tabsDir, 'index.tsx'), 'utf8');
    expect(home).toMatch(/TonightScreen/);
    expect(home).not.toMatch(/ThisWeekLinesScreen|LockOfTheDay/);
  });

  it('never asks for notification permission at launch', () => {
    const root = fs.readFileSync(path.join(repoRoot, 'app/_layout.tsx'), 'utf8');
    expect(root).not.toMatch(/initializeNotifications/);
    expect(root).not.toMatch(/requestPermissions/);
  });

  it('ships a subscription (not a paid-up-front tool) without AdMob', () => {
    const monetization = fs.readFileSync(path.join(repoRoot, 'constants/monetization.ts'), 'utf8');
    expect(monetization).toMatch(/EXPO_PUBLIC_PAYWALL_ENABLED !== '0'/);
    const settings = fs.readFileSync(path.join(repoRoot, 'components/screens/SettingsScreen.tsx'), 'utf8');
    const planCard = fs.readFileSync(path.join(repoRoot, 'components/settings/PlanCard.tsx'), 'utf8');
    expect(planCard).toMatch(/settings-subscribe/);
    expect(planCard).toMatch(/settings-restore/);
    expect(settings).toMatch(/delete-account-button/);

    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies['react-native-google-mobile-ads']).toBeUndefined();
    expect(pkg.dependencies['react-native-purchases']).toBeDefined();
  });

  it('keeps app version in sync across package.json and app.config.js', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const config = fs.readFileSync(path.join(repoRoot, 'app.config.js'), 'utf8');
    expect(config).toContain(`version: "${pkg.version}"`);
  });
});
