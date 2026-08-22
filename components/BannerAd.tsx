/**
 * AdMob is disabled. A previous launch crash was tied to the native ads SDK.
 * Keep this component as a no-op so existing call sites stay safe.
 */
export default function BannerAd() {
  return null;
}
