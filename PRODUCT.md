# PuckIQ — one job

PuckIQ is for **managing MY fantasy hockey team**. It is not a league-wide NHL briefing hub, and it does not host a new Yahoo/ESPN-style league.

Left Wing Lock already owns generic goalie/line briefings. Friends already have a Yahoo or ESPN league — we attach to it later. This app only answers: *what should I do with MY roster tonight to be the best in THAT league?*

## v1

- **Manual roster** — search official NHL players, add ~12 names, persist on device.
- **Tonight** — each of MY players: opponent, scratch/injury signal from public NHL data (`api-web.nhle.com`), start/sit leaning for roster players only.
- **News** — public RSS filtered to names on MY roster. No Left Wing Lock, Daily Faceoff, or RotoWire.
- **Yahoo / ESPN sync** — interface is in the app (`services/fantasySync.ts`) and stubbed. OAuth is next, not this release.

## Free vs Pro

PuckIQ is a **subscription**, not a one-time price.

Pro should feel like a **coach that makes you the best in YOUR league** — not another briefing hub.

| | Free | Pro (`$14.99/yr` or `$1.99/mo` list) |
|---|---|---|
| Manual roster + Tonight + filtered news | Yes | Yes |
| One sample coach suggestion | Yes | Full sit / start / drop list |
| Coach suggestions (sit X / start Y / drop Z) from MY roster + public NHL matchup/injury | Sample only | Unlock |
| Alerts: “your goalie isn’t confirmed”, “your winger is a scratch”, “better stream available” | Copy + permission | Unlock (server push later) |
| League screen: MY team vs a manually added opponent roster | Yes (manual) | Same + Yahoo attach later |
| Invite friend / attach Yahoo league | Placeholder | Same until OAuth |
| Yahoo / ESPN roster sync | — (when it ships, Pro only) | Unlock |
| Ads | May show one dismissible sports-ad slot later | None |

The coach is honest and simple: **has a game tonight + injury/scratch**. Not a fake neural net. No waivers engine, no scoring host, no social graph, no SMS invites.

Free is usable on purpose — the coaching layer is the reason to pay.

RevenueCat is already in the repo (`services/subscription.ts`, entitlement `pro`). Settings shows Subscribe / Restore. The paywall UI is on unless `EXPO_PUBLIC_PAYWALL_ENABLED=0`. Store products still need to be created in App Store Connect + RevenueCat.

**AdMob is not used.** A previous launch crash was tied to that SDK. `BannerAd` is a no-op. `SportsAdSlot` is a placeholder gated by `EXPO_PUBLIC_SHOW_AD_SLOT=1` (off by default). No ads mediation stack.

## App Store listing (later — not this PR)

Live listing today is **paid $1.99** (`com.zlce.hockeystats`). Switching to freemium is an App Store Connect **price / availability** change plus a subscription product (yearly, cheap, hockey-season priced — $9.99–$19.99/yr range). Do not flip the live listing in this PR. After that change: free download, in-app Pro subscription, Restore Purchases already in the app.

## Later

Other sports, Yahoo/ESPN OAuth import (attach the league they already play), and deeper category-vs-category tools. Not a second briefing product and not a new fantasy-league host.
