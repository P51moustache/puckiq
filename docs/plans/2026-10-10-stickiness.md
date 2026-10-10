# Stickiness: fix what fantasy hockey players complain about

*Started 2026-10-10. Goal (Zach): improve stickiness, guided by what players complain about on forums. This doc is
the contract between the three work streams; change a contract here first, then in code. Research notes:
`docs/research/2026-10-10-stickiness.md`.*

## What players complain about (that PuckIQ can fix)

1. **Daily lineup chores.** Setting a lineup every night is the job; Yahoo put smart auto-start behind Yahoo Plus.
   Reminders that fire every night whether or not anything needs changing get muted.
2. **Starting goalies.** There's no free confirmed-starter source, and the NHL only names starters at puck drop.
   Back-to-backs are when a starter most often sits.
3. **Category leagues aren't supported.** Head-to-head categories is Yahoo's default league type. PuckIQ shows
   fantasy points, and the Yahoo points preset values hits at 0, though hits are a default Yahoo category.

## Streams and file ownership

| Stream | Owns (only these paths, plus tests beside them) |
|---|---|
| **Main** (categories + integration) | `types/**`, `services/teams.ts`, `services/fantasy/scoring.ts`, `services/fantasy/categories.ts` (new), `services/fantasy/nightScore.ts`, `services/fantasy/lineup.ts`, `components/onboarding/**`, `components/sheets/LeagueSettingsSheet.tsx`, `components/tonight/**` (except `GoalieOutlookTag.tsx`), `components/screens/TonightScreen.tsx`, `services/widgets/**`, `services/native/**`, `ios/**`, `components/league/**`, `docs/**` |
| **Reminders** | `services/lineupReminders.ts`, `services/reminders/**` (new), `components/RemindersProvider.tsx`, the "Game-night reminders" section of `components/screens/SettingsScreen.tsx` |
| **Goalies** | `services/fantasy/goalieOutlook.ts` (new), `services/nhl/gamecenter.ts`, `services/nhl/goalieStarts.ts` (new), `services/fantasy/weekPlan.ts`, `hooks/useCoach.ts`, `hooks/useGoalieOutlook.ts` (new), `components/tonight/GoalieOutlookTag.tsx` (new), `components/week/**` |

Everything else is read-only for the Reminders and Goalies streams. If they need a change elsewhere, they describe
it in their final report and Main makes it.

## Contracts

- **League format.** `FantasyTeam.format?: 'points' | 'categories'` (absent means points) and
  `FantasyTeam.categories?: CategoryKey[]`. `team.scoring` always holds the weights the planner ranks by. For a
  category team, those are category-balanced weights derived from its categories. So forms, the week plan, pickups
  and reminders work unchanged for both formats.
- **Week plan.** `buildWeekPlan` keeps its signature. Optional `startChanceOn(playerId, date)` replaces a goalie's
  flat start share on that night, both in expected goalie starts and in his value (per-start value × chance), and
  `backToBackOn` records `PlayerGameDay.backToBack` for the Week grid. Callers that pass neither get the old plan.
  `goalieValueOnNight` is the one rescaling rule; pickups use it too.
- **Box score.** `GameLine` gains optional `starter` and `decision` ('W' | 'L' | 'O') for goalies, and optional
  `powerPlayPoints` for skaters (from the game summary, `services/nhl/powerPlay.ts`). The NHL only fills `starter`
  and `decision` in once a game is final. While it's live, `fetchStartingGoalies` reads the starter from ice time.
- **Notifications.** Data stays `{ screen: 'tonight', date, kind: 'lineup' | 'live' }`. Tapping one still opens Tonight.
- **GoalieOutlookTag.** A presentational component that takes one goalie's outlook. Main places it on Tonight's
  goalie rows.

## Reminders stream

Lineup reminders say exactly what to change, and by default only fire when something does. Host apps carry a
lineup forward day to day, so each night is compared with the lineup carried from the last night the team had a
starter: that night's best lineup, plus idle players who kept their seats. A night needs a change when its best
lineup seats someone the carried lineup doesn't. Swaps are minimal: a seated player is benched only when he plays
but is outranked, or when a starter needs his seat (the idle player whose next start is furthest off goes first).
The body names the swaps ("Start Hyman, Pesce · bench Kreider · G slot open"). One or two open slots are named,
but open slots alone don't fire a reminder. Without the data to rank players, or before any night has been
carried, fall back to the count-based reminder.

Measured on the real Oct 12 – Dec 6 schedule with 40 random rosters: a daily league needs a swap on about 88–96%
of nights (about two swaps a night), so the gain is mostly that every reminder is specific, not that there are
fewer of them.

## Goalies stream

Each goalie gets a start outlook for each night: likely, split or unlikely, with one short reason. It's built from
three inputs:

- his start share;
- whether his team is on a back-to-back;
- on the second night of a back-to-back, who started the first night (boxscore `starter`).

These are estimates only, never "confirmed".

- **Tonight:** each goalie row shows the outlook before puck drop. Tonight's best lineup prefers the goalie likely
  to start, and the coach's goalie move names a back-to-back.
- **Week grid:** shows "B2B" under a goalie's bar on back-to-back nights.
- **Plans:** the Week plan, pickups and reminder lineups all use the per-night chance. Streaming goalies get theirs
  from the schedule's back-to-backs, with the first night's starter left as unknown.

## Main stream

Category leagues v1:

- Setup asks "How does your league score? Points / Categories". Yahoo's default categories are preselected.
- League settings can switch the format and pick the categories PuckIQ can track.
- Tonight, the recap, the share card, the widgets and the Live Activity show the night's category tallies instead
  of a points total.

Also in Main:

- "Make these moves in Yahoo / ESPN / Fantrax" under Tonight's moves opens the host app, or the team page pasted
  in League settings.
- Live points count power-play assists, read from the game summary.
- A goalie wins only with the "W" decision once the box score has one, so a pulled starter no longer shares his
  reliever's win or shutout.
- One shared names module (`services/fantasy/names.ts`).
