# PuckIQ

PuckIQ is an NHL analytics and insights app for hockey fans who want an edge before puck drop. It turns raw league data into a fast, readable daily briefing: who's favored tonight, which goalies are confirmed, who just got hurt, and the one stat worth knowing before the games start.

PuckIQ is published on the **Apple App Store** and built with React Native and Expo.

## Features

- **Daily briefing** — A single "story of the day" leads the home screen: the model's highest-confidence game, a notable upset from last night, or a team trending toward regression or a breakout.
- **Model-backed game predictions** — Win probabilities, projected spreads and totals, and the top factors driving each pick, surfaced per matchup.
- **Goalie-confirmed alerts** — Push notifications when starting goalies are confirmed, so lineup decisions aren't made on stale information.
- **Injury alerts** — Status changes (DTD / OUT / IR) with a plain-language suggestion on who to bench or stream.
- **Morning brief** — A start/sit/bench summary delivered each morning to users who opt in.
- **Stat of the night** — A shareable, auto-generated insight nugget (player streaks, standings shifts, NHL Edge data) with one-tap sharing.
- **Teams & standings** — Team pages, head-to-head matchups, recent form, and standings snapshots.
- **Players** — League leaders, trending skaters, and projections.

All notifications are delivered through Supabase Edge Functions (`goalie-confirmed`, `injury-alert`, `morning-brief`) that read from Supabase and push via Expo.

## Tech Stack

- **React Native** + **Expo** (file-based routing via Expo Router)
- **TypeScript** (strict mode)
- **Supabase** — Postgres backend, row-level security, and Deno edge functions for scheduled push notifications
- **Jest** — unit, integration, and component tests

NHL data flows into Supabase through a scheduled sync pipeline; the app itself reads exclusively from Supabase at runtime.

## Run

```bash
npm install
npm start          # Expo dev server (opens the iOS simulator)
```

```bash
npm test           # run the test suite
npx tsc --noEmit   # type-check
```

---

Built by [Zach Lonsdale](https://www.linkedin.com/in/zach-lonsdale).
