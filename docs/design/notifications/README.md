# Notification formatting (Oct 2026)

Goal: notifications that read at a glance on the lock screen. Short titles, the key fact first, the same separators
and player/team naming everywhere, and no wrapping mid-phrase.

## Every notification the app sends today

| Kind | Sent by | Builder | Example (real output of the builder) |
|---|---|---|---|
| `lineup` | local, scheduled | `services/reminders/reminderCopy.ts` `lineupReminderCopy` | **2 lineup changes tonight**<br>Start Hyman, Pesce · bench Kreider · G slot open. First puck 7:00 PM. |
| `lineup` (2 teams) | local | same | **3 lineup changes tonight**<br>Beauties: start Hyman, Pesce +1 more · bench Kreider. Bench Mob: 4 play tonight · G slot open. First puck 7:00 PM. |
| `lineup` (no lineup data) | local | same | **Set your lineup**<br>7 of your players play tonight. First puck 7:00 PM. |
| `live` | local, at first puck | `liveReminderCopy` | **Your night is live**<br>Beauties: 7 · Bench Mob: 4. Follow your points live. |
| `goal` (my scorer) | push, live-poller | `supabase/functions/_shared/alerts.ts` `formatGoalAlert` | **🚨 Gauthier scores (2)**<br>FLA 1–2 ANA · P2 0:47 |
| `goal` (my assist only) | push | same | **🚨 Goal: Cutter Gauthier (2)**<br>FLA 1–2 ANA · P2 0:47 · assist: Carlsson |
| `scratch` | push, live-poller | `formatScratchAlert` | **Scratched: Macklin Celebrini**<br>Out tonight per the NHL game report. Check your lineup before lock. |

No notification sets a subtitle. `injury-alert`, `goalie-confirmed` and `morning-brief` Edge Functions also build pushes
("Injury Alert", "Goalie Confirmed", "Morning Lineup Brief"), but nothing calls them: they are leftovers from the
April 2026 plan and are out of scope here.

Problems seen on a real lock screen (`current-lock-screen.png`, iPhone 17 Pro): the lineup body wraps mid-phrase
("· G / slot open."), the puck-drop time comes last, "(2)" and "P2" are cryptic, the score line doesn't say who
scored or who leads, the assist-only goal never says it's your player's assist, and scratches don't name the team.

## Three concepts (Zach picked B, Checklist, on Oct 20)

- **A · Ticker** (`concept-a-ticker.png`): ALL-CAPS label + name in the title, game/team context as an iOS subtitle,
  one short fact line. e.g. **LINEUP · 2 moves before 7:00 PM** / *Beauties* / Start Hyman, Pesce · Sit Kreider · Fill G.
- **B · Checklist** (`concept-b-checklist.png`): plain short title, then one fact per line with a label.
  e.g. **Set your lineup by 7:00 PM** / Start: Hyman, Pesce / Sit: Kreider / Open: G slot.
- **C · Plain English** (`concept-c-plain.png`): title is a short sentence with the key fact, body is one or two
  natural sentences. e.g. **Make 2 moves before 7:00 PM** / Start Hyman and Pesce, sit Kreider, and fill your empty G slot.

All three use data the poller already has: the scoring team (`details.eventOwnerTeamId`) for "ANA leads 2–1", and the
scratched player's side of the right-rail report for "SJS". The mockups draw cards a little wider than a real
iPhone, so the chosen one gets checked on the simulator for wrapping before it ships.

## What shipped (concept B)

| Kind | Title | Body (one line per fact) |
|---|---|---|
| `lineup` | Set your lineup by 7:00 PM | Start: Hyman, Pesce / Sit: Kreider / Open: G slot |
| `lineup` (no moves or no data) | Set your lineup by 7:00 PM | Playing: 7 of your players |
| `lineup` (2 teams) | Set your lineups by 7:00 PM | Beauties: Start Hyman, Pesce +1 more / Beauties: Sit Kreider / Bench Mob: Fill G slot |
| `live` | Your night is live | 7 of your players are playing (2 teams: Beauties: 7 playing / Bench Mob: 4 playing) |
| `goal` (my scorer) | 🚨 Gauthier scores | ANA leads FLA 2–1 · 2nd, 0:47 / Goal #2 this season / Assist: Carlsson |
| `goal` (my assist) | 🚨 Carlsson gets an assist | Gauthier scored · ANA leads FLA 2–1 / 2nd period, 0:47 |
| `scratch` | Celebrini scratched tonight | Out per the NHL game report (SJS vs LAK) / Swap him before lock |

An overtime goal reads "ANA beats FLA 3–2 · OT, 4:14"; a tying goal "ANA ties FLA 2–2". With several teams, every line
starts with the team name: one line per team wrapped mid-fact on the iPhone 17 Pro, which shows about 38 characters
per line. Checked on the simulator lock screen: `result-lock-screen.png`, `result-two-teams.png`, `result-goal.png`.
The lock screen shows up to four body lines; a banner shown while the phone is in use shows two, so the most urgent
line (Start, the score) always comes first.

Builders: `services/reminders/reminderCopy.ts` (local reminders) and `supabase/functions/_shared/alertCopy.ts` (goal
and scratch pushes, re-exported from `alerts.ts`).
