# PuckIQ season two: live nights, League Room, alerts, widgets

*Started 2026-10-06. Work runs in parallel streams with strict file ownership so no two streams edit the
same file. This doc is the contract between streams: change a contract here first, then in code.*

## Streams and file ownership

| Stream | Owns (only these paths) | Must not touch |
|---|---|---|
| **Main** (coordinator) | `components/screens/TonightScreen.tsx`, `components/tonight/**`, `components/league/**`, `app/**` (routes, tab layout), `components/PageHeader.tsx`, `components/screens/PickupsScreen.tsx`, `components/screens/SettingsScreen.tsx`, `components/sheets/**`, `components/share/**`, `components/coach/**`, `hooks/**`, `services/fantasy/**`, `services/nhl/**`, `services/nhlDate.ts`, `services/teams.ts`, `services/analytics/**`, `types/**`, `constants/**`, `docs/**`, `PRODUCT.md`, `__tests__/**` (root) | — |
| **Backend** | `supabase/**`, `site/**`, `scripts/supabase/**` | app code |
| **League services** | `services/league/**` (code + `__tests__`) | UI, types (ask Main to change `types/league.ts`) |
| **Native** | `ios/**`, `modules/**`, `app.config.js`, `eas.json` (extension credentials only), `services/native/**` | JS screens |
| **Week** | `components/screens/WeekScreen.tsx`, `components/week/**` | everything else |

Shared read-only inputs every stream may import: `types/fantasy.ts`, `types/league.ts`, `services/fantasy/*`,
`services/nhl/*`, `components/coach/ui.tsx`, `components/coach/motion.tsx`, `components/sheets/HowItWorksSheet.tsx`.

Tooling on this Mac: no global node. Use `NODE=/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node`
then `$NODE node_modules/.bin/jest <paths>` and `$NODE node_modules/.bin/tsc --noEmit -p .`. Tests and typecheck
must stay green for the files a stream owns. `__tests__/shipping-surfaces.test.ts` already fails on the old Settings
assertion; Main fixes it with the tab change.

## 1. Nightly loop (Main)

- **NHL game day.** Tonight follows a *game day* that rolls over at 6:00 AM Eastern, not midnight, so a 10:30 PM ET
  puck drop stays on Tonight until it ends (`services/nhlDate.ts`, `GAME_DAY_ROLLOVER_HOUR_ET`).
- **Live mode.** Once any of my games starts: hero = tonight's fantasy points (best-lineup starters), live / final /
  to-go counts, top performer; player cards sorted by live points; "big night" purple when a line beats 2.5× the
  player's per-game value; overflow players show points that had no slot.
- **Recap.** Until noon ET, Tonight leads with last night: starter points, top performer, overflow points, and
  *hindsight %* (PuckIQ's pre-game lineup value captured ÷ the best lineup in hindsight). Recap share card.
- Pure logic lives in `services/fantasy/nightScore.ts` (tested); screens only render it.

## 2. League Room (Backend + League services + Main)

A private room for the league people already play in. Every member who joins makes everyone's coach more accurate:
rostered players become *taken* for Pickups, the weekly opponent fills in automatically, and the room gets a
game-night board, preset reactions, a Monday recap card, a dues tracker and (Pro) a trade finder.

- **Auth:** Sign in with Apple (already live). Rooms need `auth.uid()`. No anonymous auth.
- **No free-text chat.** Reactions are a fixed emoji set. Room and team names pass a name filter; any member can
  leave, the owner can remove a member, and Settings has "Report a room" (support email) — App Review 1.2.
- **Invite:** code of 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Link
  `https://p51moustache.github.io/puckiq/join.html?code=ABC234` (web page with "Open in PuckIQ" + App Store) and deep
  link `puckiq://join/ABC234` (Expo Router route `app/join/[code].tsx`). The in-app "Join with code" field also works.
- A local `FantasyTeam` links to a room with `roomId`. Its roster is pushed to the room on change (debounced); the
  opponent the member picks in the room fills `team.opponent` with `opponentSource: 'room'`.

### Database (Backend) — `public` schema, all writes through RPCs

| Table | Columns |
|---|---|
| `rooms` | `id uuid pk`, `code text unique` (pattern above), `name text` (1–40), `platform text` (yahoo/espn/fantrax/other), `league_size int` (4–20), `slots jsonb`, `scoring jsonb`, `owner_id uuid → auth.users on delete set null`, `dues jsonb` (`RoomDues`, snake_case keys), `created_at`, `updated_at` |
| `room_members` | `room_id → rooms on delete cascade`, `user_id → auth.users on delete cascade`, `team_name text` (1–40), `roster jsonb` (`FantasyPlayer[]`, ≤ 30), `roster_updated_at`, `opponent_user_id uuid null`, `joined_at`; pk (`room_id`,`user_id`) |
| `room_dues_status` | `room_id`, `user_id`, `paid bool`, `updated_at`; pk (`room_id`,`user_id`); fk → `room_members` on delete cascade |
| `room_reactions` | `id bigint identity`, `room_id`, `from_user_id`, `to_user_id`, `emoji` (one of `ROOM_REACTIONS`), `created_at` |

RLS: members of a room can `select` that room's rows in all four tables (via a `security definer`
`is_room_member(room uuid)` helper). No direct insert/update/delete for clients.

RPCs (`security definer`, `set search_path = public`, `auth.uid()` required, return types below):

| RPC | Args | Returns | Rules |
|---|---|---|---|
| `create_room` | `p_name, p_platform, p_league_size, p_slots, p_scoring, p_team_name, p_roster` | `rooms` row | new unique code; caller becomes owner + member + dues row |
| `join_room` | `p_code, p_team_name, p_roster` | `rooms` row | code case-insensitive; full when members = `league_size`; re-join updates name/roster |
| `leave_room` | `p_room` | void | owner leaving hands ownership to the earliest member; last one out deletes the room |
| `update_membership` | `p_room, p_team_name, p_roster, p_opponent` | void | own row; opponent must be another member or null |
| `update_room` | `p_room, p_name, p_dues` | `rooms` row | owner only |
| `set_dues_paid` | `p_room, p_user, p_paid` | void | owner only |
| `remove_member` | `p_room, p_user` | void | owner only, not self |
| `rotate_room_code` | `p_room` | `rooms` row | owner only |
| `react` | `p_room, p_to_user, p_emoji` | void | both members; ≤ 30 reactions per sender per room per hour; rows older than 7 days purged |

### Alerts (Backend + Main)

- `alert_devices` (`expo_push_token` pk, `player_ids int[]` gin-indexed, `prefs jsonb` `{scratches, goals}`,
  `platform`, `app_version`, `updated_at`) — service role only.
- `live_game_state` (`game_id` pk, `game_date`, `game_state`, `scratch_ids int[]`, `goal_event_ids int[]`,
  `updated_at`) and `alert_log` (`expo_push_token`, `event_key`, `sent_at`; pk both) — service role only.
- Edge function **`register-alerts`** (no JWT): `POST { token, playerIds, prefs: { scratches, goals }, appVersion }`
  upserts; `DELETE { token }` removes. Validates the Expo token shape and ≤ 150 ids. Responds `{ ok: true }`.
- Edge function **`live-poller`** (cron, every minute): today's `/v1/score/{date}` (game day), scratches from
  `right-rail` within 90 min of puck drop, goals from `play-by-play` while live; diff against `live_game_state`;
  Expo push to devices whose `player_ids` overlap; dedupe through `alert_log`. Copy: "🚨 Connor McDavid scores (2) ·
  EDM 3–1 LAK · P2 10:15" and "Scratched: Mark Scheifele is out tonight (NHL game report)". Exits early when no
  game is within 90 minutes or live.
- Cron SQL ships as a template (`supabase/cron/live-poller.sql`). Each call carries a single-use ticket
  minted by `public.issue_poller_ticket()` (migration 20261006000200) and redeemed once by the
  function (deployed with JWT verification off), so no service-role key is stored anywhere.

## 3. Widgets and Live Activity (Native)

- App Group `group.com.zlce.hockeystats`; widget extension `PuckIQWidgets`, bundle `com.zlce.hockeystats.widgets`.
- JS API in `services/native/widgetBridge.ts` (Main may import; Native implements; no-ops where unsupported):

```ts
publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void>
liveActivitiesSupported(): boolean
startOrUpdateLiveActivity(attrs: { teamName: string; date: string }, state: LiveActivityState): Promise<boolean>
endLiveActivity(state?: LiveActivityState): Promise<void>
```

- Widgets: small (count + first-lock countdown), medium (+ up to 4 players with puck drop), lock-screen rectangular
  and inline. When `live` is set they show points and live / final counts instead.
- Live Activity: lock screen + Dynamic Island with points, live / final / to-go, top performer line, clock.
  Updated by the app while it runs; server push updates need an APNs key the user must create later.
- URL scheme `puckiq` added next to the existing ones.

## 4. Week (Week)

- F1 tyre-strategy grid: each player row is a stint strip over Mon–Sun. Pro: solid team-colour bar = game that
  counts, hatched outline = plays but no slot, empty = no game; off-night columns tinted; a red "now" line on today.
  Free: plain team-colour bars (no counts/overflow distinction), with the existing upsell.
- Replace the footnote legend with `HowItWorksButton topic="week"`. Matchup shows "synced from League Room" when
  `team.opponentSource === 'room'`.

## 5. Polish (Main)

- Merge consecutive overflow "sit" moves into one card with faces. Footnotes → `HowItWorksSheet`.
- Count-up numerals and tabular countdown digits (`components/coach/motion.tsx`); haptic on new goals.
- Tabs: Tonight · Week · Pickups · League · Roster. Settings moves to a gear in the page header.
- Free tier: the third "mark taken" in a week opens the paywall (`source: 'pickups_hide'`).

## Analytics events to add

`live_view` (`live_count`, `final_count`), `recap_view`, `room_create`, `room_join` (`source`: link/code),
`room_leave`, `room_reaction`, `room_dues_edit`, `trade_finder_open`, `trade_idea_view`, `alerts_enable`
(`scratches`, `goals`), `widget_publish` (sampled, once per day), `live_activity_start`.
