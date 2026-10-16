# Onboarding quick-pick: concept A (selected 2026-10-15)

Zach chose concept A ("face grid") from three concepts (A face grid, B two doors, C roster shape).
This is the reference for the build and the visual review.

## Why
Users with their own roster of 10+ players returned 63% of the time; users with an empty or
tiny roster returned 5%, and sample-team-only users 0 of 4. Half of the people who finished setup
had 0 players, and 3 of 33 turned reminders on during setup.

## Roster step
1. Title "Add your players", lede "Tap everyone on your roster." with the count added.
2. Screenshot import card on top (dark ink card, red scan icon, "Whole roster in 20 sec").
3. Search field ("Search anyone else"); typing swaps the grid for search results.
4. F / D / G segmented tabs with "Most owned" on the right.
5. Three-column grid of face tiles: headshot, last name, team. Selected tiles get a green
   (`colors.good`) border and a check. Most-owned first (same cut as Pickups, 12-team league).
6. "Continue with N" primary button (needs at least one player).
7. "Not sure yet? Try the sample team" as the only way past without players.
   No "I'll add players later" and no reminders step in setup.

## Reminder ask (moved out of setup)
A bottom sheet on Tonight, after the first lineup call is on screen:
"Lineup locks at 7:00 PM" / "Want a ping <lead time> before, with this call?" /
"Remind me" (primary) / "Not now". It follows the existing prompt rules (game night, before puck
drop, never once the OS has refused, at most two "Not now" a week apart).
