/**
 * Links Apple requires near any auto-renewing subscription purchase.
 * Terms default to Apple's standard EULA; privacy/support pages live in site/.
 */

export const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Published from site/ to the repo's gh-pages branch. */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://p51moustache.github.io/puckiq/privacy.html';

export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL || 'https://p51moustache.github.io/puckiq/support.html';

export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'zlce.app@gmail.com';

export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * NHL player photos come from the NHL's CDN. Flip to false to fall back to position
 * monograms everywhere (e.g. if the NHL or App Review objects). Team logos are not used.
 */
export const USE_NHL_HEADSHOTS = true;

export const STARTING_GOALIES_URL = 'https://www.dailyfaceoff.com/starting-goalies';
