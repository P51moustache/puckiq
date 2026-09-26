# PuckIQ

PuckIQ is a fantasy hockey coach for **your** roster, in the Yahoo, ESPN, or Fantrax league you already play. Add your players once (NHL player search) and every night it tells you who plays, who's scratched, the best lineup your league's slots allow, and which pickups fill your empty nights.

Free to download, with a PuckIQ Pro subscription. See [PRODUCT.md](PRODUCT.md) for the product spec and Free vs Pro.

## Features

- **Tonight** — "5 of your 13 play tonight · 1 problem · first puck 7:00 PM", per-player puck-drop countdowns, NHL scratch confirmations, roster-filtered injury news, live box-score lines, and coach moves to make before lock. Toggle to tomorrow.
- **Best lineup** (Pro) — slot-aware start/sit for C/LW/RW/F/D/UTIL/G, multi-position eligibility, IR.
- **Week** — players × Mon–Sun grid with off-nights; Pro adds games that count, bench overflow, empty slots, next week, and a head-to-head matchup.
- **Pickups** — streamers ranked by value added to your lineup over the rest of the week; filter by position and night; hides players your league size almost always rosters.
- **Player sheet** — season line, last-14 form, game log, eligibility and IR editing.
- **Lineup reminders** — one local notification before the first puck on nights your players play.
- **Multiple leagues** (Pro) and optional cloud backup (Sign in with Apple/Google).

## Tech

- React Native + Expo (Expo Router), TypeScript strict
- Public NHL APIs (`api-web.nhle.com`, `api.nhle.com/stats/rest`) through a cached, rate-limit-aware client (`services/nhl/`)
- Fantasy engine as pure, tested modules (`services/fantasy/`)
- RevenueCat for subscriptions, Supabase for optional auth/backup, Jest

## Run

```bash
npm install
npm start          # Expo dev server (iOS)
```

```bash
npm test             # unit + component tests
npx tsc --noEmit     # type-check
npm run smoke:coach  # live end-to-end run of the coach against real NHL data (network)
```

Copy `.env.example` to `.env`. Supabase keys are optional; the coach runs on public NHL data. Set `EXPO_PUBLIC_DEV_PRO=1` to try Pro locally.

Release steps for the subscription launch: [docs/RELEASE-3.0.md](docs/RELEASE-3.0.md).

---

Built by [Zach Lonsdale](https://www.linkedin.com/in/zach-lonsdale).
