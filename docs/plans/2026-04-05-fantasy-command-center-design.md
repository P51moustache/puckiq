# PuckIQ Pro — Fantasy Command Center Design

**Date**: 2026-04-05
**Status**: Approved
**Target User**: Fantasy hockey players
**Revenue Model**: Freemium subscription (RevenueCat)

---

## Vision

Transform PuckIQ from a general hockey analytics app into the #1 fantasy hockey companion — the app fantasy players open every morning to set their lineups. Monetized via freemium subscription with a free ad-supported tier and a $6.99/mo Pro tier.

---

## 1. App Structure & Navigation

### Current → Proposed

| Current | Proposed |
|---------|----------|
| 3 tabs: Players, Upcoming, Explore | 5 tabs: Today, **My Team** (center), Players, Explore, **Hub** |
| Upcoming is default tab | My Team is default tab (daily destination) |
| Settings is a no-op button | Hub screen: account, subscription, settings, accuracy |
| Models hidden in Explore sub-screen | Models stays in Explore but more prominent |

### Tab Layout

| Position | Tab | Purpose | Tier |
|----------|-----|---------|------|
| 1 | Today | Tonight's games + picks (refined home screen) | Free (basic) / Premium (ML picks) |
| 2 | My Team | Fantasy roster, start/sit, projected points, weekly outlook | Premium |
| 3 | Players | Enhanced with fantasy projections, waiver wire scout | Mixed |
| 4 | Explore | Current stats/teams/models + matchup analyzer | Mixed |
| 5 | Hub | Account, subscription, settings, accuracy tracker | Free |

### Daily User Flow
Open app → My Team (check lineup recommendations) → Today (see tonight's games) → Players (check waiver wire) → set lineup in Yahoo/ESPN.

---

## 2. My Team Screen

The core differentiator. The screen fantasy players open every morning.

### Roster Management
- **Manual roster builder**: search and add players, select fantasy platform scoring format
- **CSV/paste import**: copy roster from fantasy platform, paste into app
- **API sync (V2)**: Yahoo Fantasy API OAuth — future feature, not launch scope

### Scoring Format Support
- Yahoo default categories (G, A, +/-, PPP, SOG, Hits, Blks, W, SV%, GAA)
- ESPN default (similar with slight variations)
- Custom category weights (premium)

### Screen Layout

```
┌─────────────────────────────┐
│  My Team — Week 22          │
│  Yahoo H2H Categories       │
├─────────────────────────────┤
│  TODAY'S LINEUP              │
│  ┌─────────────────────────┐│
│  │ C  McDavid  ✅ START    ││
│  │   vs VGK · Proj: 4.2pts││
│  │ LW Huberdeau ⚠️ SIT    ││
│  │   vs DAL · B2B, cold   ││
│  └─────────────────────────┘│
│                              │
│  BENCH / IR                  │
│  ┌─────────────────────────┐│
│  │ G  Hellebuyck (IR)      ││
│  │   🔔 Expected back Mon  ││
│  └─────────────────────────┘│
│                              │
│  WEEKLY OUTLOOK              │
│  Games remaining: 12 (opp: 14)│
│  Category edges: G, A, PPP  │
│  Category gaps: Hits, Blk   │
├─────────────────────────────┤
│  WAIVER WIRE PICKS           │
│  🔥 Byfield — 78% rostered │
│     trending ↑, soft sched  │
└─────────────────────────────┘
```

### Start/Sit Engine
Powered by ML pipeline + existing features:
- Tonight's projected fantasy points (by scoring format)
- Opponent strength (goals against, PK%, save %)
- Rest/B2B status (already computed in features.yaml)
- Recent form (L5 rolling stats — already available)
- Confirmed starter (goalies) via daily sync
- Hot/cold streak detection (already in playerTrends)

---

## 3. ML-Powered Fantasy Projections

### Existing Infrastructure
- LightGBM + LR ensemble predicting game outcomes
- 54 features in features.yaml
- Player props model (Poisson GLMs, 5 features, avg MAE 0.41)
- Player trends service (hot/cold, momentum, projections)

### New Components

#### 3a. Fantasy Points Projection Model
- Extend player_props model → projected fantasy points per scoring format
- Input: player rolling stats, opponent defensive metrics, game context (home/away, B2B, goalie matchup)
- Output: projected G, A, SOG, Hits, Blks, +/-, PPP for skaters; W, SV%, GAA for goalies
- Convert raw stat projections → fantasy points using format-specific weights
- Projection layer on TOP of player_props, not a new model from scratch

#### 3b. Start/Sit Scoring
- Combine projected fantasy points + confidence interval + floor/ceiling range
- Flag: "must start" (high floor), "upside play" (high ceiling, low floor), "sit" (bad matchup or cold)
- Comparative: "Start X over Y because..."

#### 3c. Waiver Wire Intelligence
- Daily scan: players with rising underlying stats trending up
- Schedule-aware: "Byfield has 4 games next week including 2 vs bottom-5 defenses"
- Surface players on pace to exceed draft position

#### 3d. Weekly Matchup Analyzer
- Project category-by-category outcomes given roster + opponent roster (manual input)
- Identify close categories and which players could swing them
- "You're losing Hits 142-158. Starting Deslauriers over Huberdeau tonight gains ~3 hits"

#### Pipeline Integration
- Projections run as part of daily_predict.py alongside game predictions
- New `ml_player_projections` Supabase table for player-level projections
- App queries this table directly (read-only, same pattern as existing data)

---

## 4. Subscription & Paywall

### Tech Stack
RevenueCat SDK — handles Apple/Google subscriptions, receipt validation, entitlements.

### Tiers

| Feature | Free | Pro ($6.99/mo) |
|---------|------|----------------|
| Tonight's games + scores | Yes | Yes |
| Basic player stats & standings | Yes | Yes |
| Game predictions (win/loss only) | Yes | Yes |
| Ads | Banner (AdMob) | None |
| ML confidence scores & probabilities | — | Yes |
| My Team (roster + start/sit) | — | Yes |
| Fantasy point projections | — | Yes |
| Waiver wire scout | — | Yes |
| Weekly matchup analyzer | — | Yes |
| Custom prediction models | — | Yes |
| Push notifications | — | Yes |
| Player deep dive (advanced trends) | — | Yes |

### Pricing
- **Monthly**: $6.99/mo
- **Annual**: $49.99/yr (~$4.17/mo, 40% savings — prominently featured)
- **Free trial**: 7 days of Pro on first install

### Paywall UX
- Soft paywall: free users see features exist but blurred/locked with "Unlock with Pro" CTA
- Never a hard wall that blocks the app entirely
- Free tier must feel useful to drive word-of-mouth
- AdMob banner at bottom of Today and Players screens (no interstitials)

---

## 5. User Accounts & Data Sync

### Tech Stack
Supabase Auth (already on Supabase for everything else).

### Auth Methods
1. **Apple Sign In** — required by App Store for any social login
2. **Google Sign In** — covers Android + many iOS users
3. **Email/password** — fallback

### Data Sync Strategy

| Synced to Account (Supabase) | Stays Local (AsyncStorage) |
|------------------------------|---------------------------|
| Fantasy roster & scoring format | Analytics session data |
| Favorite teams | UI preferences (last tab, etc.) |
| Custom prediction models | Firebase event queue |
| Subscription status (RevenueCat ID) | |
| Pick history & accuracy stats | |

### Migration
- On first login, detect existing AsyncStorage data and offer to migrate
- Existing users lose nothing

### Anonymous-First
- Free tier works without account creation
- Account prompted when user tries sync features (My Team, custom models) or starts Pro trial

---

## 6. Push Notifications

### Tech Stack
Expo Notifications + Supabase Edge Functions for server-side triggers.

### Notification Types (All Premium-Only)

| Type | Timing | Example |
|------|--------|---------|
| Morning Lineup Brief | 9am local | "3 of your players play tonight. Huberdeau is a sit — B2B vs Dallas." |
| Goalie Confirmed | ~11am ET (when announced) | "Hellebuyck confirmed starting vs CGY. Start with confidence." |
| Injury Alert | Real-time via sync pipeline | "Draisaitl DTD — consider benching or picking up Byfield" |
| Game Start Reminder | 30min before puck drop | "Your lineup locks in 30min. 1 recommended change." |
| Waiver Wire Alert | Morning after big performances | "Byfield: 2G 1A last night, 62% rostered. Grab him?" |

### Delivery
Supabase Edge Function on schedule → check user roster against games/news → Expo Push API.

### User Controls
Granular toggles per notification type in Hub settings. Default: Morning Brief + Injury Alerts on, others off.

### Out of Scope
No live goal alerts, score updates, or social notifications. Not competing with ESPN/NHL on real-time scores.

---

## 7. Onboarding Flow

4 screens, under 90 seconds.

### Screen 1: Welcome
"PuckIQ — Win Your Fantasy League"
- [Continue with Apple] [Continue with Google] [Skip for now]

### Screen 2: Pick Your Platform
"What fantasy platform do you use?"
- [Yahoo] [ESPN] [Just browsing]
- Sets scoring format. Skipped if "Just browsing."

### Screen 3: Build Your Roster
"Add a few key players to get personalized picks"
- Search bar — add 3-5 players minimum
- [Skip — I'll do this later]
- Partial roster is fine.

### Screen 4: Tonight's Preview (Immediate Value)
"Here's what PuckIQ sees tonight"
- Top pick of the night with ML confidence
- If roster added: "McDavid is a must-start tonight — soft matchup vs SEA"
- [Start Free Trial] [Continue Free]

### Principles
- Account creation on screen 1, but "Skip" always visible
- Show personalized value by screen 4 even with minimal input
- Free trial CTA after they've seen value, not before
- Returning users who skipped: subtle "Finish setup" card on Today screen for 3 sessions

---

## 8. Social & Viral Features

Lightweight — no feed, no chat, no community management burden.

### Shareable Pick Cards
- Beautiful card image for any game prediction: matchup, win probability, pick, PuckIQ branding
- Share to Instagram Stories, Twitter/X, iMessage, group chats
- Extend existing HeroBanner share button with more visual fantasy context

### Accuracy Tracker (Hub)
- "Your picks hit 62% this season" with chart over time
- "Your model outperformed the default by 4%"
- Shareable season summary card: "My PuckIQ 2025-26 Season"

### Leaderboard (Lightweight)
- Global accuracy leaderboard: "Top PuckIQ Predictors This Week"
- Opt-in with display name — no social graph, no following, no messaging
- Just a ranked list for competitive engagement

### Referral Program
- "Give a friend 1 month free, get 1 month free" via RevenueCat promo codes
- Shareable referral link from Hub screen

### Explicitly NOT Building
Comments, chat, forums, friend lists, shared leagues.

---

## Tech Additions Summary

| Addition | Purpose |
|----------|---------|
| RevenueCat SDK | Subscription management, entitlements, receipt validation |
| AdMob SDK | Banner ads on free tier |
| Supabase Auth | User accounts (Apple, Google, email) |
| Expo Notifications (server-side) | Push notifications via Edge Functions |
| `ml_player_projections` table | Fantasy point projections from ML pipeline |
| Fantasy projection pipeline step | Extends daily_predict.py |

---

## What Stays the Same
- Today's game predictions (enhanced with fantasy context)
- Player stats/trends (enhanced with fantasy projections)
- Team comparison tools
- Edge stats
- Custom prediction models
- Deep dive modals (game + player)
- Dark theme, existing design system
- Supabase-only data architecture
- ML pipeline infrastructure (features.yaml, models, training)
