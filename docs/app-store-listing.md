# PuckIQ 3.0 — App Store Listing

## Metadata

**Name:** PuckIQ: Fantasy Hockey Coach

**Subtitle (30):** Lineups, streamers & scratches

**Category:** Sports · Secondary: Utilities

**Price:** Free with In-App Purchases (PuckIQ Pro)

**Support URL:** https://p51moustache.github.io/puckiq/support.html

**Privacy Policy URL:** https://p51moustache.github.io/puckiq/privacy.html

**Marketing URL:** https://p51moustache.github.io/puckiq/

**Contact email:** zlce.app@gmail.com

---

## Promotional text (170)

New season, new PuckIQ: who plays, who to sit, and who to stream before lock — built around your Yahoo, ESPN or Fantrax roster. Free, with PuckIQ Pro for the full coach.

## What's New (3.0)

PuckIQ 3.0 is a brand-new app — rebuilt as a nightly coach for your fantasy hockey team.

• Tonight: who plays, a countdown to lock, NHL scratch checks, and exactly who to sit
• Best lineup: the lineup your league's slots allow, filled slot by slot
• Week planner: games that actually count once your slots fill up — this week and next
• Pickups: streamers ranked by the empty nights they fill for YOUR team
• Player pages with game logs and NHL Edge speed and shot stats
• Share cards for the league chat, lineup reminders, and a whole new look

PuckIQ is now free to download, with PuckIQ Pro for the full coaching tools. Bought PuckIQ before? Pro is included — if it doesn't show, tap Restore Purchases in Settings.

## Description

PuckIQ is the coach for your fantasy hockey team — in the Yahoo, ESPN, or Fantrax league you already play. Add your players once. Every night PuckIQ tells you who plays, who's scratched, and exactly what to change before lock.

TONIGHT
• How many of your players play tonight, with a countdown to your first lock
• Coach moves before lock: who to sit when your slots are full, and which slots sit empty
• Scratches straight from the NHL game report — marked Confirmed only when the NHL posts them
• Injury news filtered to your players only
• Live stat lines while your games are on
• A lineup reminder before first puck, only on nights your players play

YOUR WEEK
• Every player's games, Monday to Sunday, with off-nights highlighted
• PRO: games that actually count once your lineup slots fill up — see bench overflow and empty slots before they cost you

PICKUPS
• Your top streamer, ranked by the value he adds to YOUR lineup — only nights he'd actually start for you
• PRO: the full ranked list, filtered by position and night, hiding players your league already rosters

SHARE
• Turn tonight's lineup or your week into a card for the league group chat

PUCKIQ PRO
• Tonight's best lineup for your league's exact positions (C, LW, RW, F, D, UTIL, G)
• Every coach move before lock: overflow sits, empty slots, goalie start rates, injury checks
• Week planner for this week and next
• Head-to-head matchup: enter your opponent's roster once, then compare games that count day by day
• Player trends and full-season game logs
• NHL Edge stats: skating speed, shot speed, and danger-zone numbers ranked against the league
• Up to 5 leagues

PuckIQ never logs in to your league or changes your lineup — you make the moves in your fantasy app. No ads.

Subscriptions: PuckIQ Pro is available as a yearly (season) or monthly auto-renewing subscription. Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://p51moustache.github.io/puckiq/privacy.html

Schedules, scratches, and stats come from public NHL data. PuckIQ is not affiliated with or endorsed by the NHL, Yahoo, ESPN, or Fantrax.

## Keywords (100)

Name and subtitle words are already indexed, so they aren't repeated here.

```
nhl,start sit,waiver wire,pickups,goalie,yahoo,espn,fantrax,off night,roster,matchup,edge,stats,gp
```

## Screenshots

Rendered with `python3 scripts/store/campaign_screenshots.py` into `marketing/screenshots/app-store-v2/`
(not committed), in the style of the approved Bench Games ad. Uploaded 2026-09-27.
iPhone 6.9" (1320×2868) is the only iPhone size App Store Connect requires; iPad 13" (2064×2752) is required because the app supports iPad.
Every Pro feature carries a PRO tag or a "with Pro" line; free limits are in `constants/monetization.ts`.

| # | iPhone | Headline | Tag |
|---|--------|----------|-----|
| 1 | Puck art + week card (41 count, 7 lost to bench) | Your bench is costing you. | WEEK PLANNER · PRO |
| 2 | Tonight, coach move lifted out | Know what to fix before lock. | 01 / TONIGHT (every move with Pro) |
| 3 | 41 of 48 left this week count, −7 benched | The games that count. | 02 / WEEK · PRO |
| 4 | Pickups, Kreider card lifted out | Find games that fit. | 03 / PICKUPS · PRO |
| 5 | Best lineup grid | The lineup your slots allow. | 04 / BEST LINEUP · PRO |
| 6 | Player page + NHL Edge card | Scout every player. | 05 / PLAYERS (logs, form, Edge with Pro) |
| 7 | Share card | Talk trash in the group chat. | 06 / SHARE |
| 8 | Three phones | Make every game count. | Free to download; Pro unlocks the full coach |

iPad: bench hero, Tonight, Week (Pro), Pickups (Pro), Roster.

## App Privacy

| Data | Purpose | Linked | Tracking |
|---|---|---|---|
| Email (optional sign-in) | Account / backup | Yes | No |
| User ID (optional sign-in) | Account / backup | Yes | No |
| Purchase history (RevenueCat) | Subscriptions | Yes | No |
| User content: fantasy roster (optional backup) | App functionality | Yes | No |
| Usage data: product interaction (screens, features used) | Analytics | No | No |
| Identifiers: random app-generated install ID (for analytics) | Analytics | No | No |

No ads, no advertising ID (IDFA), no location, no contacts. Analytics go to PostHog with a random install ID —
never the account ID, email, or roster — and can be turned off in Settings. The privacy policy must say so.

## Review notes

As submitted with build 27 (2026-09-27):

```
PuckIQ 3.0 is a fantasy hockey coach: it helps users manage the roster they already play in Yahoo/ESPN/Fantrax. Users add their players by searching NHL players; the app never signs in to or changes a fantasy league. No betting, picks, odds, or real-money contests.

No account needed. On first launch tap "Set up my team", then on the players step tap "Just looking? Try a sample team" to load a full roster (a card offers "Remove sample players" later). Or search any NHL player (e.g. "McDavid").

The NHL regular season starts September 29. Before opening night the app shows last season's stats (labeled 2025-26) and looks ahead to opening week.

PuckIQ is now free to download (it was a paid app). PuckIQ Pro is an auto-renewing subscription: Season (yearly, 7-day free trial) or Monthly. Open the paywall from Settings > See Pro or any PRO card (e.g. Tonight > Best lineup). Restore Purchases is on the paywall and in Settings. People who bought the old paid app keep Pro automatically (checked from the App Store receipt).

Sign in with Apple is optional and only backs up teams. Account deletion: Settings > Backup > Delete account (shown when signed in). Feedback: Settings > About > Send feedback.

The iOS 26 launch crash from the 2.3.0 review is fixed in this build.
```
