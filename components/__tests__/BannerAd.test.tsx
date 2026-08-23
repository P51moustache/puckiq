import fs from 'fs';
import path from 'path';
import BannerAd from '../BannerAd';

const repoRoot = path.join(__dirname, '../..');

describe('BannerAd', () => {
  it('is a no-op so AdMob never loads at launch', () => {
    expect(BannerAd()).toBeNull();
  });
});

describe('AdMob is fully unloaded', () => {
  it('does not depend on react-native-google-mobile-ads', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies['react-native-google-mobile-ads']).toBeUndefined();
    expect(pkg.devDependencies?.['react-native-google-mobile-ads']).toBeUndefined();

    const lock = fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8');
    expect(lock).not.toMatch(/react-native-google-mobile-ads/);
  });

  it('does not configure a GAD application ID or AdMob plugin', () => {
    const config = fs.readFileSync(path.join(repoRoot, 'app.config.js'), 'utf8');
    expect(config).not.toMatch(/react-native-google-mobile-ads/);
    expect(config).not.toMatch(/GADApplicationIdentifier/);
    expect(config).not.toMatch(/iosAppId|ios_app_id|androidAppId|android_app_id/);

    const plist = fs.readFileSync(path.join(repoRoot, 'ios/PuckIQ/Info.plist'), 'utf8');
    expect(plist).not.toMatch(/GADApplicationIdentifier/);
  });
});
