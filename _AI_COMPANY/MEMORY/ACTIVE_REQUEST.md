# Active Request

## Status: IN PROGRESS — Sprint 7

## Current Sprint (Two Changes)

### Change 1: Remove YourTeamCard
- **Status:** COMPLETED (task #5 done)
- **Scope:** Delete YourTeamCard component and remove from Tonight screen

### Change 2: Redesign Stat of the Night
- **Status:** COMPLETED — All Gauntlets passed, shipped
- **Scope:** Transform from a forgettable footnote into a cinematic "stop and look" card
- **Baseline Gauntlet:** All three personas scored BORED
- **Final Gauntlet:** All three personas scored EXCITED
  - Shark: EXCITED — 56px hero number with glow, category emoji + chip, regex handles all insight types
  - Debater: EXCITED — team gradient + glass circles + branding = screenshot-worthy
  - Homer: EXCITED — team color glow, spring animation, 36px logo in glass circle, 160px height
- **All 12 acceptance criteria PASS**
- **Regex fix:** `extractHeroNumber()` updated to handle parenthesized numbers like "(+5)" — verified via Node.js, 14 tests pass

## Previous Request (Cycle 6)
"The Personal Terminal" — Tonight Tab Overhaul. Option B (Bold) approved 2026-02-06. COMPLETED 2026-02-07. 10 new files, 35 new tests, index.tsx reduced 60% (744→299 lines), zero regressions.
