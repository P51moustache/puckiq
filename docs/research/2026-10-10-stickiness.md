# What fantasy hockey players complain about (October 2026)

*Research for the stickiness round (`docs/plans/2026-10-10-stickiness.md`). Three passes on 2026-10-10: Reddit
(r/fantasyhockey, r/YahooFantasy), hockey forums and commissioner guides, and the apps and tools people use. Reddit
blocks direct fetching, so that pass relied on search-result snippets of each thread rather than full threads. Vote
counts weren't visible. Everything here is paraphrased.*

## The complaints, ranked

| # | Complaint | How often | PuckIQ today |
|---|---|---|---|
| 1 | **Setting a lineup every night.** In October 2025 Yahoo moved "start active players for the week" into Fantasy Plus ($39.99/yr). Commissioners say daily lineups burn casual managers out and kill leagues. | Every season, loud | Tonight lists the moves; **reminders now name the swaps and stay quiet when nothing changes** (this round) |
| 2 | **Who starts in goal.** Teams confirm starters anywhere from the morning skate to warmups. The NHL publishes no starter before puck drop. Weekly goalie minimums make one start decide a week. | Every game day | Start share on Tonight; **back-to-back outlook per night** (this round). A *confirmed* starter needs a licensed feed (Daily Faceoff, Goalie Post, Left Wing Lock, SportsDataIO). |
| 3 | **Category leagues get points advice.** Head-to-head categories is Yahoo's default. The new Yahoo app buries category totals, and bangers (hits, blocks) are invisible to points tools. | Several threads a season | **Category mode** (this round): setup question, evenly weighted categories, live category tallies |
| 4 | **The numbers don't match my app.** A mismatch between live points and the host app costs trust. | Recurring | Yahoo's default points preset (3.2); power-play assists still missing from live points |
| 5 | **Late scratches and vague injuries.** The NHL has no injury-disclosure window, and the first reliable look is at warmups. | Every game day | Confirmed scratch push from the NHL scratch list (3.0) |
| 6 | **Schedule math.** Off-nights, games that count, bench overflow, goalie minimums and games-played caps. | High in-season | Week planner, off-night pickups (core of PuckIQ) |
| 7 | **Roster entry and syncing.** Typing in 20 players is a chore. Hosts offer no read access without OAuth. | Medium | Screenshot import (3.2) |
| 8 | **Host apps that lag, crash or bury things** after every fall redesign. | Every September–October | PuckIQ is the fast read-only view; moves still happen in the host |
| 9 | **The season is long.** People drift at the holidays and once they're out of contention. The league's social life moved to group chats. | Mid-season | League Room, morning recap, share cards |

## What alerts should do (from the alerts research)

- **Wanted:** goalie confirmations, scratches and late scratches, injuries to *my* players, power-play (PP1) and line
  changes.
- **Hated:** late alerts, all-or-nothing settings, setting alerts up one player at a time, promotions, spoilers.
- **Rule for PuckIQ:** every alert before lock says what to do and by when: the player, the game time and the swap.
  Only 2 of 15 users have reminders on, so each push has to earn its place.

## Shipped in this round

1. **Smart lineup reminders.** Reminders name the swaps ("Start Hyman · bench Kreider · G slot open"). By default
   they only fire on nights the best lineup changes.
2. **Goalie start outlook.** Each goalie gets likely, split or unlikely per night, from his start share, back-to-backs
   and who started the night before. These are estimates, never "confirmed".
3. **Category leagues.** These are Yahoo's default categories, evenly weighted from last season's spreads. Tonight, the
   recap, share cards, the widgets and the Live Activity show the night category by category.

## Next candidates (public NHL data unless noted)

- **"Open in Yahoo / ESPN / Fantrax" from a reminder.** The user pastes their team link once, and the reminder
  jumps straight to the team page. This completes "lineup diff + jump".
- **Power-play assists in live points.** The game `landing` endpoint lists each goal's strength and its assists. That
  closes the last gap with Yahoo's live totals.
- **Morning brief.** A short list of usage changes: PP1 and line promotions from shift and ice-time data, injury
  returns, and today's best add given adds left.
- **Live head-to-head in the League Room.** My night against my opponent's, with a "your matchup is live" push. It
  starts the evening sweat, which so far has had one view.
- **Second-half purpose.** Side pots, a spoiler role for eliminated teams, a holiday-week plan, and a fantasy-playoff
  schedule planner from February.
- **Category mode v2.** Live category standings against the opponent, ratio protection for goalies, and
  category-aware pickups ("you need hits").
