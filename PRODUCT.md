# PuckIQ — one job

PuckIQ is for **managing MY fantasy hockey team**. It is not a league-wide NHL briefing hub.

Left Wing Lock already owns generic goalie/line briefings. This app only answers: *who on my roster should I start tonight, and what news about those players can change that?*

## v1

- **Manual roster** — search official NHL players, add ~12 names, persist on device.
- **Tonight** — each of MY players: opponent, scratch/injury signal from public NHL data (`api-web.nhle.com`), start/sit leaning for roster players only.
- **News** — public RSS filtered to names on MY roster. No Left Wing Lock, Daily Faceoff, or RotoWire.
- **Yahoo / ESPN sync** — interface is in the app (`services/fantasySync.ts`) and stubbed. OAuth is next, not this release.

## Free vs Pro

PuckIQ is a **subscription**, not a one-time price.

| | Free | Pro (`$14.99/yr` or `$1.99/mo` list) |
|---|---|---|
| Manual roster + Tonight + filtered news | Yes | Yes |
| Yahoo / ESPN roster sync | — (when it ships, Pro only) | Unlock |
| Push alerts for MY players (goalie / scratch / injury) | — | Unlock |
| Ads | May show one dismissible sports-ad slot later | None |
| More than one league | — | Later |

Free is usable on purpose. Pro is the hockey-season extras worth paying for.

RevenueCat is already in the repo (`services/subscription.ts`, entitlement `pro`). Settings shows Subscribe / Restore. The paywall UI is on unless `EXPO_PUBLIC_PAYWALL_ENABLED=0`. Store products still need to be created in App Store Connect + RevenueCat.

**AdMob is not used.** A previous launch crash was tied to that SDK. `BannerAd` is a no-op. `SportsAdSlot` is a placeholder gated by `EXPO_PUBLIC_SHOW_AD_SLOT=1` (off by default). No ads mediation stack.

## App Store listing (later — not this PR)

Live listing today is **paid $1.99** (`com.zlce.hockeystats`). Switching to freemium is an App Store Connect **price / availability** change plus a subscription product (yearly, cheap, hockey-season priced — $9.99–$19.99/yr range). Do not flip the live listing in this PR. After that change: free download, in-app Pro subscription, Restore Purchases already in the app.

## Later

Other sports, Yahoo/ESPN OAuth import, and deeper category-vs-category tools. Not a second briefing product.
