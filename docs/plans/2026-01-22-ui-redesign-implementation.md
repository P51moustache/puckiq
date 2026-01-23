# PuckIQ Redesign: Implementation Plan

**Design Doc:** `docs/plans/2026-01-22-ui-redesign-design.md`

**Principle:** After each significant UI change, take a screenshot to verify it looks correct before moving on.

---

## Phase 0: Foundation

*Set up the new structure without breaking existing functionality*

### Tasks

- [ ] Create new tab structure (Today, Learn, My IQ)
- [ ] **Screenshot:** Verify 3-tab navigation appears correctly
- [ ] Remove Models tab from navigation
- [ ] Remove model builder components and related code
- [ ] Move settings to gear icon in header
- [ ] **Screenshot:** Verify gear icon placement and tap target
- [ ] Create stub pages for Learn tab (empty state)
- [ ] Create stub pages for My IQ tab (empty state)
- [ ] **Screenshot:** Verify each tab shows placeholder content
- [ ] Update routing configuration
- [ ] Test deep links still work
- [ ] **Screenshot:** Full app walkthrough of all tabs

### Deliverable
New app skeleton with 3 tabs. Existing pick functionality still works.

---

## Phase 1: Core Pick Experience

*The daily loop - the heart of the app*

### Tasks

#### Breakdown Cards
- [ ] Design new game card component with breakdown format
- [ ] Create factor icon set (home ice, goaltending, rest, etc.)
- [ ] Implement 3-factor breakdown layout
- [ ] **Screenshot:** Single game card with breakdown
- [ ] Build factor calculation logic (determine top 3 factors per game)
- [ ] Connect live data to breakdown display
- [ ] **Screenshot:** Today tab with multiple game cards

#### Pick Flow
- [ ] Redesign pick buttons (cleaner, clearer)
- [ ] Add "PuckIQ says" as subtle reference
- [ ] Implement pick confirmation state
- [ ] **Screenshot:** Pick flow before/during/after selection

#### Results Experience
- [ ] Design results card layout ("what actually mattered")
- [ ] Build post-game factor analysis logic
- [ ] Implement checkmark/X display for factors
- [ ] Add "Your Insight" summary text generation
- [ ] **Screenshot:** Results card for completed game
- [ ] **Screenshot:** Multiple results in a day

### Deliverable
Users can make picks with educational breakdowns and see what mattered after games.

---

## Phase 2: Weekly Theme System

*Structure that makes learning stick*

### Tasks

#### Theme Infrastructure
- [ ] Define weekly theme data model
- [ ] Create theme rotation schedule (12-16 weeks)
- [ ] Build logic to determine current theme
- [ ] Store user's weekly progress

#### Theme UI
- [ ] Design theme banner component
- [ ] Add theme banner to Today tab header
- [ ] **Screenshot:** Today tab with theme banner
- [ ] Highlight theme-related factor in breakdowns (visual emphasis)
- [ ] **Screenshot:** Game card with highlighted theme factor

#### Weekly Recap
- [ ] Design weekly recap screen
- [ ] Build weekly stats aggregation
- [ ] Generate "Key Learning" text
- [ ] **Screenshot:** Weekly recap screen
- [ ] Add navigation to recap from Today tab

### Deliverable
Each week has a theme. Users see it highlighted and get a recap.

---

## Phase 3: Learn Tab

*The educational hub*

### Tasks

#### Factor Leaderboard
- [ ] Build factor tracking database/storage
- [ ] Calculate factor win rates from historical data
- [ ] Design leaderboard UI
- [ ] **Screenshot:** Factor Leaderboard full view
- [ ] Add trend indicators (up/down/steady)
- [ ] Connect to weekly theme ("This week's theme is #2 on the leaderboard")

#### Coach's Corner Structure
- [ ] Design Coach's Corner page layout
- [ ] Create lesson card component
- [ ] Implement category navigation (Fundamentals, Advanced, etc.)
- [ ] **Screenshot:** Coach's Corner home
- [ ] Design individual lesson view
- [ ] **Screenshot:** Single lesson expanded

#### Go Deeper Links
- [ ] Add "Go Deeper" link component to breakdown factors
- [ ] Connect links to relevant Coach's Corner lessons
- [ ] **Screenshot:** Game card with Go Deeper link visible
- [ ] **Screenshot:** Flow from breakdown → lesson

#### Teams & Players
- [ ] Refactor Explore tab content into Learn tab
- [ ] Reframe as "research" / study material
- [ ] **Screenshot:** Teams view in Learn tab
- [ ] **Screenshot:** Player detail in Learn tab

### Deliverable
Users can explore hockey knowledge: leaderboard, lessons, team/player research.

---

## Phase 4: My IQ Tab

*Personal progress and stats*

### Tasks

#### Core Stats
- [ ] Build accuracy tracking (overall, by factor)
- [ ] Design My IQ dashboard layout
- [ ] Implement overall accuracy display
- [ ] **Screenshot:** My IQ top section with accuracy

#### Factor Profile
- [ ] Track accuracy per factor type
- [ ] Design strengths/weaknesses display
- [ ] **Screenshot:** Factor profile section

#### Milestones & Streaks
- [ ] Define milestone triggers (100 picks, 70% accuracy, etc.)
- [ ] Build streak tracking
- [ ] Design milestones display
- [ ] **Screenshot:** Milestones section

#### Pick History
- [ ] Design pick history list view
- [ ] Implement filtering/sorting
- [ ] **Screenshot:** Pick history scrolled

#### Full Page
- [ ] Assemble all sections into My IQ tab
- [ ] **Screenshot:** Full My IQ tab scrolled top to bottom

### Deliverable
Users see their growth: accuracy, strengths, milestones, history.

---

## Phase 5: Content

*The lessons that make it educational*

### Tasks

#### Templates
- [ ] Create Coach's Corner lesson markdown template
- [ ] Create weekly theme intro template
- [ ] Define factor explanation format

#### Fundamental Lessons (10-15)
- [ ] What is save percentage?
- [ ] Home ice advantage explained
- [ ] Why rest matters (and when it doesn't)
- [ ] Reading a team's record
- [ ] Understanding streaks
- [ ] Special teams basics (PP%, PK%)
- [ ] What recent form tells you
- [ ] Divisional rivalries
- [ ] Back-to-back games
- [ ] Goalie workload
- [ ] **Screenshot:** Coach's Corner with fundamentals populated

#### Advanced Lessons (10-15)
- [ ] Expected goals (xG) demystified
- [ ] Shot quality vs shot quantity
- [ ] What Corsi and Fenwick measure
- [ ] High-danger chances explained
- [ ] Line matchups and deployment
- [ ] Zone entries: carry vs dump
- [ ] Forechecking systems
- [ ] Power play structures (umbrella, 1-3-1)
- [ ] Penalty kill formations
- [ ] The art of pulling the goalie
- [ ] PDO and luck vs skill
- [ ] **Screenshot:** Coach's Corner with advanced section

#### Weekly Theme Content
- [ ] Write intro text for each theme week
- [ ] Define which factors map to which themes
- [ ] **Screenshot:** Theme intro for one week

### Deliverable
Coach's Corner is populated. Weekly themes have content.

---

## Phase 6: Onboarding & Notifications

*First impressions and retention*

### Tasks

#### Onboarding
- [ ] Design 4 onboarding screens
- [ ] Build onboarding flow component
- [ ] **Screenshot:** Screen 1 - Hook
- [ ] **Screenshot:** Screen 2 - How it works
- [ ] **Screenshot:** Screen 3 - First pick
- [ ] **Screenshot:** Screen 4 - You're in
- [ ] Implement first-pick during onboarding
- [ ] Store onboarding completion state
- [ ] **Screenshot:** Full onboarding flow walkthrough

#### Notification Logic
- [ ] Build daily insight generation (analyze yesterday's games)
- [ ] Build weekly trend detection (mid-week check-in)
- [ ] Build surprising result detection
- [ ] Build weekly recap generation

#### Notification Scheduling
- [ ] Implement notification scheduling system
- [ ] Set up weekday cadence (Mon-Sun)
- [ ] Create notification content templates
- [ ] Test notification delivery

### Deliverable
New users get proper onboarding. All users get educational notifications.

---

## Phase 7: Polish

*Make it feel great*

### Tasks

#### Visual Design Pass
- [ ] Typography audit (consistent sizes, weights)
- [ ] Spacing/padding audit
- [ ] Color palette refinement (warm, not cold)
- [ ] **Screenshot:** Before/after comparison of key screens

#### Iconography
- [ ] Finalize factor icon set
- [ ] Ensure icon consistency across app
- [ ] **Screenshot:** All icons in context

#### Animations
- [ ] Add milestone celebration animation
- [ ] Add pick confirmation feedback
- [ ] Add subtle transitions between states
- [ ] **Screenshot/Video:** Animations in action

#### Empty States
- [ ] Design empty state for no games today
- [ ] Design empty state for no picks yet
- [ ] Design empty state for new user (no history)
- [ ] **Screenshot:** Each empty state

#### Error Handling
- [ ] Network error states
- [ ] Data loading states
- [ ] Graceful fallbacks
- [ ] **Screenshot:** Error and loading states

### Deliverable
App feels polished, professional, delightful.

---

## Phase Sequence

```
Phase 0 (Foundation)
    │
    ▼
Phase 1 (Core Pick Experience)
    │
    ▼
Phase 2 (Weekly Themes)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3 (Learn)    Phase 5 (Content) ← can run in parallel
    │                  │
    ▼                  │
Phase 4 (My IQ)        │
    │                  │
    ├──────────────────┘
    ▼
Phase 6 (Onboarding & Notifications)
    │
    ▼
Phase 7 (Polish)
```

---

## Screenshot Checklist Summary

Key screens to capture at each phase:

| Phase | Screenshots |
|-------|-------------|
| 0 | 3-tab nav, gear icon, stub pages |
| 1 | Game card breakdown, pick flow, results card |
| 2 | Theme banner, highlighted factor, weekly recap |
| 3 | Factor leaderboard, Coach's Corner, Go Deeper flow, Teams/Players |
| 4 | My IQ dashboard, factor profile, milestones, pick history |
| 5 | Populated Coach's Corner, theme intro |
| 6 | All 4 onboarding screens |
| 7 | Before/after polish, icons, animations, empty/error states |

---

## Notes

- Each phase should be committable independently
- Take screenshots to verify UI before moving to next task
- Content (Phase 5) can be written while Phases 3-4 are being built
- User testing recommended after Phase 2 (core experience is complete)
