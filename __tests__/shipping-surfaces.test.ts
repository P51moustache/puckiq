import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');

describe('Week 1 shipping surfaces', () => {
  it('makes this week’s lines the home tab and hides pick-edge / extra-team tabs', () => {
    const layout = fs.readFileSync(path.join(repoRoot, 'app/(tabs)/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/title: 'Lines'/);
    expect(layout).toMatch(/name="news"[\s\S]*href: null/);
    expect(layout).toMatch(/name="league"[\s\S]*href: null/);
    expect(layout).toMatch(/name="players"[\s\S]*href: null/);
    expect(layout).toMatch(/name="stats"[\s\S]*href: null/);
    expect(layout).toMatch(/name="models"[\s\S]*href: null/);
    expect(layout).toMatch(/name="teams"[\s\S]*href: null/);
    expect(layout).not.toMatch(/title: 'Tonight'/);
    expect(layout).not.toMatch(/title: 'News'/);
    expect(layout).not.toMatch(/title: 'League'/);
  });

  it('opens the Lines tab on ThisWeekLinesScreen', () => {
    const home = fs.readFileSync(path.join(repoRoot, 'app/(tabs)/index.tsx'), 'utf8');
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
    expect(pkg.version).toBe('2.3.0');
  });
});
