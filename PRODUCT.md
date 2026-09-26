# PuckIQ — one job

PuckIQ is **the coach for MY fantasy hockey team**, in the Yahoo, ESPN, or Fantrax league I already play. It is not a league-wide NHL briefing hub, not a betting/picks product, and not a new league host.

It answers three questions, every day of the season:

1. **Tonight** — who of mine plays, is anyone scratched, and what do I change before lock?
2. **This week** — how many of my games actually count once my lineup slots fill up, and where are the holes?
3. **Pickups** — who should I stream to fill *my* empty nights?

We never log in to or write to the league. The user makes the move in their host app. Last-minute scratches are a physics problem: we promise **personal and on time**, never "earlier than the NHL".

## Data (public NHL only)

| Need | Source | Confidence label |
|---|---|---|
| Schedule, off-nights | `api-web.nhle.com/v1/schedule/{date}` (calendar dates only, never `/now`) | — |
| Tonight's slate, live state | `api-web.nhle.com/v1/score/{date}` | — |
| Scratches | gamecenter `right-rail` | **Confirmed** (the only confirmed signal) |
| Injury hints | ESPN NHL RSS filtered to MY players | **Likely** |
| Live stat lines | gamecenter `boxscore` | — |
| Season / last-14 / league pool | `api.nhle.com/stats/rest` (batched by player id) | — |
| Current team (trades) | stats `skater/bios`, `goalie/bios` | — |
| Player detail | `player/{id}/landing`, `game-log` | — |
| Telemetry (speed, shot speed, zone time, goalie save % by danger) | `edge/skater-detail`, `edge/goalie-detail` (falls back to last season until the new one has games) | — |

Goalie starters are **never** claimed before puck drop — the NHL doesn't publish them. We show start share instead.

All NHL reads go through `services/nhl/client.ts`: memory + disk TTL cache, in-flight dedupe, 4-per-host concurrency cap, 429 backoff, stale-on-failure.

## The engine (`services/fantasy/`)

- **Lineup** (`lineup.ts`) — league slots (C/LW/RW/F/D/UTIL/G). Greedy-by-value augmenting-path matching → the highest-value set of starters, who sits on overflow, which slots go empty.
- **Week plan** (`weekPlan.ts`) — the lineup solved for each day: games, games that count, bench overflow, empty slots; whole week vs remaining.
- **Form** (`form.ts`) — value per team game from transparent points weights; season blended with last season early on, 60/40 with last-14-days; goalie value × start share.
- **Coach** (`coach.ts`) — tonight's moves: confirmed scratch → injury check → overflow sit → empty slot → goalie unconfirmed → no-game housekeeping.
- **Pickups** (`pickups.ts`) — value added to MY lineup over the rest of the week, counting only nights he'd start (empty-slot fills first). Hides players a league of this size almost always rosters; "mark taken" hides the rest.
- **Matchup** (`matchup.ts`) — my remaining games that count vs my opponent's (manual roster), same rules.

## Free vs Pro

PuckIQ is **free to download with a Pro subscription** (RevenueCat entitlement `pro`).

| | Free | Pro |
|---|---|---|
| Roster from real NHL players | 1 team | Up to 5 teams |
| Tonight: who plays, countdown, NHL scratch, injury news, live lines | Yes | Yes |
| Week schedule grid + off-nights | Yes | Yes |
| Coach moves | First move | Full list |
| Tonight's best lineup (slot-aware) | — | Yes |
| Games that count / overflow / empty slots, next week | — | Yes |
| Pickups ranked for my holes | Top pick | Full list, by position and night |
| Matchup: my usable games vs theirs | — | Yes |
| Player trends: last-14 form, full game log | Last 5 games | Yes |
| NHL Edge telemetry, league percentiles | Headline stat | Full panel |
| Share cards (tonight, week) for league chats | Yes | Yes |
| Lineup reminder before first puck | Yes | Yes |

Free is genuinely useful on purpose — it builds the nightly habit. The coaching layer is what people pay for.

**Pricing (recommendation):** $19.99 per season (annual) with a 7-day free trial, $4.99 monthly with no trial. Against a ~7-month season of monthly ($34.93), annual saves 43% — that is the "SAVE 43%" badge the paywall computes from live store prices. Prices live in App Store Connect; the app reads them from the store.

**Grandfathering:** anyone who bought PuckIQ when it was a $1.99 paid app gets Pro free. `EXPO_PUBLIC_FREEMIUM_CUTOVER` = the date the App Store price went to Free; the app compares it with the receipt's original purchase date.

**No AdMob, ever.** A previous launch crash was tied to that SDK. `BannerAd` is a no-op; `SportsAdSlot` stays off.

## Accounts

Optional. Sign in with Apple/Google only to back up teams (`user_data`, owner-only RLS). Account deletion is in Settings (App Store 5.1.1(v)) via the `delete-account` edge function.

## Analytics

Events go to PostHog over its HTTP batch API (`services/analytics/posthog.ts`), anonymously: a random install ID,
never the account ID, email, or roster. Every event carries `is_pro`. Off until `EXPO_PUBLIC_POSTHOG_KEY` is set;
users can turn it off in Settings.

| Event | When | Properties |
|---|---|---|
| `$screen` | tab/route change | `$screen_name` |
| `onboarding_step` / `onboarding_complete` | first run | `step` / `players`, `sample_team`, `reminders` |
| `paywall_view` / `paywall_purchase` / `paywall_restore` | paywall | `source`, `plan`, `result` |
| `player_open` | player sheet | `context` |
| `pickup_add` | quick-add from Pickups | `when`, `rank` |
| `share_card` | share sheet | `kind`, `outcome` |
| `reminders_enable`, `team_add` | settings / onboarding | `granted` / `platform` |

## Notifications

Local only: one "set your lineup" reminder, 30/60/90 minutes before the first puck among my players. Permission is asked only when the user turns it on. (1.x–2.x scheduled a daily "Your Pick Results" push for a dead feature and asked for permission at launch; 3.0 clears those once.)

## Later

1. **League import** — Yahoo Fantasy API (OAuth, needs a small token-exchange server), ESPN public-league reads, Fantrax. Real waiver availability replaces "likely rostered".
2. **Server push** for MY players: scratch posted, goalie confirmed in warmups (edge function + pg_cron).
3. **Categories-league mode** — per-category needs for H2H cats.
4. Home-screen widget / Live Activity for tonight.
