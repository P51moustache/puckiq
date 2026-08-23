import BannerAd from '../BannerAd';

describe('BannerAd', () => {
  it('is a no-op so AdMob never loads at launch', () => {
    expect(BannerAd()).toBeNull();
  });
});
