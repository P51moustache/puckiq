# PuckIQ — one job

PuckIQ is for **managing MY fantasy hockey team**. It is not a league-wide NHL briefing hub, and it does not host a new Yahoo/ESPN-style league.

Left Wing Lock already owns generic goalie/line briefings. Friends already have a Yahoo or ESPN league — we attach to it later. This app only answers: *what should I do with MY roster tonight to be the best in THAT league?*

## Complaint-driven edges (2026)

These are the unique edges. They come from real host-app and briefing-app complaints. We do not copy those products. We do not scrape them.

### Yahoo / ESPN (the hosts people already use)

We never become the host. Friends already play there. We tell you what to change in *their* app.

| What people complain about | Our edge |
|---|---|
| Injury / inactive / goalie alerts arrive **after lock** or never | Pro alerts are **only for MY players**, aimed at **before that player’s game locks**. Home shows a **lock countdown per player** (puck-drop = lock). |
| Apps **crash or freeze** when changing lineup last-minute | **v1 never writes the Yahoo/ESPN lineup.** Coach says what to change in their app. We must not crash. |
| **Football-first UI**; hockey is a mode | We are **hockey-only**. Not a season-mode toggle inside a football app. |
| Yahoo **paywalls “set lineup for the week”** and daily-login friction | **Free** shows the **whole week of MY games** with no paywall. No host login required to see your slate. |
| **Full-screen ads** after roster moves | **No AdMob** (a previous launch crash). At most **one quiet ad slot later**, never an interstitial on a decision. |
| Host **injury status lags 1–2 days** | Prefer **NHL official** game/roster endpoints (`api-web.nhle.com` score + gamecenter right-rail) for scratches. Label confidence **Confirmed / Likely / Unknown**. **Never fake Confirmed.** |

### Left Wing Lock (the briefing people already pay $4/yr for)

LWL is the best **generic** goalie/line feed. It is not roster-aware. Competing on “who posted the scratch first for the whole league” is a losing game.

| What they are | Our edge |
|---|---|
| Whole-league goalie/line feed | We are **MY team**, not the whole league. Home is “3 of YOUR guys play tonight. 1 problem. 1 move.” — not a briefing newspaper. |
| Last-minute scratches are a physics problem | Users already know this. **Do not promise earlier than the NHL.** Promise **quieter, personal, on time.** |

## v1

- **Manual roster** — search official NHL players, add ~12 names, persist on device.
- **Tonight** — each of MY players: opponent, lock countdown, scratch/injury from public NHL data (`api-web.nhle.com`), start/sit leaning, confidence label. Headline is count + problems + one move.
- **My week (Free)** — `api-web.nhle.com/v1/schedule/{YYYY-MM-DD}` mapped to MY roster teams. Whole week, no paywall. Calendar date only — do not use `/score/now` or `/schedule/now` (they jump to the next slate in the off-season).
- **News** — public RSS filtered to names on MY roster. No Left Wing Lock, Daily Faceoff, or RotoWire.
- **Coach** — sit / start / drop from MY roster + public NHL matchup/injury. Footer: change it in Yahoo or ESPN. We never write the lineup.
- **Yahoo / ESPN sync** — interface is in the app (`services/fantasySync.ts`) and stubbed. OAuth is next, not this release. Even then, v1 does not push lineup writes.

## Confidence (never fake Confirmed)

| Label | When |
|---|---|
| **Confirmed** | Player is on the NHL gamecenter right-rail scratch list. Official game/roster endpoint only. |
| **Likely** | Injury / scratch / out language in roster-filtered public news. Not an official lineup sheet. |
| **Unknown** | Everything else — including a healthy skater with a game and no scratch posted. We do **not** label that Confirmed. Goalie starter is unknown until the NHL posts it. |

Host apps lag 1–2 days. We prefer the NHL sheet when it exists. We still do not invent a confirmed healthy or a confirmed starter.

## Free vs Pro

PuckIQ is a **subscription**, not a one-time price.

Pro should feel like a **coach that makes you the best in YOUR league** — not another briefing hub.

| | Free | Pro (`$14.99/yr` or `$1.99/mo` list) |
|---|---|---|
| Manual roster + Tonight + filtered news | Yes | Yes |
| Whole week of MY games | Yes — no paywall | Yes |
| Lock countdown per player | Yes | Yes |
| Confidence labels (Confirmed / Likely / Unknown) | Yes | Yes |
| One sample coach suggestion | Yes | Full sit / start / drop list |
| Coach suggestions (sit X / start Y / drop Z) from MY roster + public NHL matchup/injury | Sample only | Unlock |
| Alerts: MY players only, **before that player’s game locks** (“your goalie isn’t confirmed”, “your winger is a scratch”, “better stream available”) | Copy + permission | Unlock (server push later) |
| League screen: MY team vs a manually added opponent roster | Yes (manual) | Same + Yahoo attach later |
| Invite friend / attach Yahoo league | Placeholder | Same until OAuth |
| Yahoo / ESPN roster **read** (when OAuth ships) | — | Unlock |
| Yahoo / ESPN lineup **write** | Never in v1 | Never in v1 |
| Ads | May show one quiet, dismissible slot later — never an interstitial on a decision | None |

The coach is honest and simple: **has a game tonight + injury/scratch**. Not a fake neural net. No waivers engine, no scoring host, no social graph, no SMS invites.

Free is usable on purpose — the coaching layer and before-lock alerts are the reason to pay.

RevenueCat is already in the repo (`services/subscription.ts`, entitlement `pro`). Settings shows Subscribe / Restore. The paywall UI is on unless `EXPO_PUBLIC_PAYWALL_ENABLED=0`. Store products still need to be created in App Store Connect + RevenueCat.

**AdMob is not used.** A previous launch crash was tied to that SDK. Do not add `react-native-google-mobile-ads`, a `GADApplicationIdentifier`, or a test/real GAD app ID. `BannerAd` is a no-op. `SportsAdSlot` is a placeholder gated by `EXPO_PUBLIC_SHOW_AD_SLOT=1` (off by default). No ads mediation stack. Never a full-screen ad after a roster move.

## Home screen

Not a briefing newspaper. One glance:

> **3 of YOUR guys play tonight. 1 problem. 1 move.**

Then the week of MY games, then the one coach move (change it in Yahoo or ESPN), then MY players with lock countdown and confidence.

## App Store listing (later — not this PR)

Live listing today is **paid $1.99** (`com.zlce.hockeystats`). Switching to freemium is an App Store Connect **price / availability** change plus a subscription product (yearly, cheap, hockey-season priced — $9.99–$19.99/yr range). Do not flip the live listing in this PR. After that change: free download, in-app Pro subscription, Restore Purchases already in the app.

## Later

Yahoo/ESPN OAuth **read** (attach the league they already play), deeper category-vs-category tools, and that one quiet ad slot if Free needs it. Not a second briefing product, not a new fantasy-league host, and not lineup writes into Yahoo/ESPN.
