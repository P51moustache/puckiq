# PuckIQ UI Redesign: "Become a Hockey Expert"

## Overview

A complete redesign of PuckIQ from a prediction utility into a hockey education app where users learn the game by making picks and seeing what actually matters.

**Core Principle:** Learn hockey → Make picks to practice → See what you got right → Get smarter

## The Problem

Current app issues:
- **Disconnected features** - Tabs feel like separate apps with no clear user journey
- **Unclear value proposition** - Users don't understand what they should do or why
- Too data-heavy, feels like a Bloomberg terminal for hockey

## The Vision

Transform PuckIQ into an app where:
- Every pick teaches you something about hockey
- Your accuracy improves as your knowledge grows
- Advanced concepts are accessible, not intimidating
- The experience is clean, smart, and respects your intelligence

---

## Navigation Structure

**3 tabs (down from 4):**

| Tab | Purpose | Contents |
|-----|---------|----------|
| **Today** | Daily picks with breakdowns | This week's theme banner, game cards with breakdowns, make picks, live results |
| **Learn** | Educational hub | Weekly theme lesson, Factor Leaderboard, Coach's Corner, Teams & Players |
| **My IQ** | Personal progress | Your record, factor profile, streaks/milestones, pick history |

**What got cut/demoted:**
- Model builder → Advanced feature inside Learn (for power users)
- Profile settings → Gear icon, not a whole tab
- Achievements → Folded into My IQ as milestones

---

## Core Experience: The Daily Loop

### 1. Open App → See This Week's Theme

Each week focuses on one hockey concept:
- Week 1: Home Ice Advantage
- Week 2: Goaltending Matchups
- Week 3: Rest & Fatigue
- Week 4: Special Teams
- Week 5: Recent Form & Streaks
- Week 6: Divisional Rivalries
- (cycles through season, including advanced weeks)

### 2. Browse Today's Games with Breakdowns

Each game card shows 3 key factors explained in plain language:

```
┌─────────────────────────────────┐
│  CHI @ CAR                      │
│  7:00 PM · Theme: Goaltending   │
├─────────────────────────────────┤
│  THE BREAKDOWN                  │
│                                 │
│  GOALIE EDGE › CAR              │
│  Andersen .932 vs Mrazek .891   │
│  [Go deeper: What makes a       │
│   goalie "hot"?]                │
│                                 │
│  HOME ICE › CAR                 │
│  15-3-1 at home                 │
│                                 │
│  REST › Even                    │
│  Both teams 2 days rest         │
│                                 │
├─────────────────────────────────┤
│  Based on this, who wins?       │
│                                 │
│  ┌─────────┐    ┌─────────┐     │
│  │   CHI   │    │   CAR   │     │
│  └─────────┘    └─────────┘     │
└─────────────────────────────────┘
```

**"Go Deeper" links:** Contextual links to Coach's Corner lessons when you want more detail.

### 3. Make Your Picks

Simple, clear pick buttons. No friction.

### 4. Games Play Out → Results Show What Mattered

After games finish, the results card shows:

```
┌─────────────────────────────────┐
│  CAR 4 - CHI 2    FINAL         │
│  ✓ You picked CAR               │
├─────────────────────────────────┤
│  WHAT ACTUALLY MATTERED         │
│                                 │
│  ✓ GOALIE EDGE                  │
│    Andersen: 31 saves, .939     │
│    This was the difference.     │
│                                 │
│  ✓ HOME ICE                     │
│    CAR scored 2 in the 1st      │
│    Home crowd energy paid off.  │
│                                 │
│  ✗ REST                         │
│    CHI actually outshot CAR     │
│    Fatigue wasn't a factor.     │
│                                 │
├─────────────────────────────────┤
│  YOUR INSIGHT                   │
│  Goaltending and home ice were  │
│  real. Rest was noise tonight.  │
└─────────────────────────────────┘
```

### 5. End of Week → Recap What You Learned

```
┌─────────────────────────────────┐
│  WEEK 3 COMPLETE                │
│  Theme: Goaltending             │
├─────────────────────────────────┤
│  Your record:     9-4 (69%)     │
│  Season accuracy: 64%           │
├─────────────────────────────────┤
│  KEY LEARNING                   │
│  Goalie matchups predicted      │
│  winners 71% of the time this   │
│  week. Trust the hot goalie.    │
└─────────────────────────────────┘
```

---

## Learning System

### Weekly Themes

**Monday:** Short lesson introducing the concept (30 seconds to read)

**All week:** Every breakdown highlights that factor

**Sunday:** Recap with your stats and key learnings

**Theme rotation:**
- Fundamentals: Home ice, goaltending, rest, recent form
- Intermediate: Special teams, divisional games, shot quality
- Advanced: xG, line matchups, zone entries, puck possession

### Factor Leaderboard

A living leaderboard showing which factors actually predict wins this season:

```
┌─────────────────────────────────┐
│  FACTOR LEADERBOARD (2024-25)   │
├─────────────────────────────────┤
│  1. Goaltending Edge      68%   │
│  2. Home Ice              61%   │
│  3. Recent Form (L10)     58%   │
│  4. Rest Advantage        54%   │
│  5. Special Teams         52%   │
│  ...                            │
│  11. Back-to-Back         47%   │
└─────────────────────────────────┘
```

**Value:** Real hockey knowledge. Myth-busting. Shareable.

### Coach's Corner

A library of bite-sized hockey lessons organized by difficulty:

```
COACH'S CORNER

Fundamentals
├── What is save percentage?
├── Home ice advantage explained
├── Why rest matters (and when it doesn't)
├── Reading a team's record

Advanced
├── Expected goals (xG) demystified
├── Shot quality vs shot quantity
├── What Corsi and Fenwick measure
├── High-danger chances explained

Coaching Concepts
├── Line matchups and deployment
├── Zone entries: carry vs dump
├── Forechecking systems
├── Power play structures
├── The art of pulling the goalie

Goaltending
├── What makes a goalie "hot"
├── Workload and fatigue
├── High-danger save percentage
├── Tracking goalie form
```

**Each lesson includes:**
1. The concept - Plain language explanation
2. Why it matters - How it affects who wins
3. What to watch for - How to spot it in games
4. Example - A recent real game where this mattered

**Tone:** Like a smart friend who played hockey explaining it over a beer. Not textbook. Not condescending.

---

## Personal Progress: My IQ

A stats page you visit when curious. **Pull, not push.** No nagging.

```
┌─────────────────────────────────┐
│  MY HOCKEY IQ                   │
├─────────────────────────────────┤
│  Overall Accuracy: 64%          │
│  Picks This Season: 247         │
├─────────────────────────────────┤
│  YOUR STRENGTHS                 │
│  Goaltending: 73%               │
│  Home ice: 66%                  │
├─────────────────────────────────┤
│  ROOM TO GROW                   │
│  Rest advantage: 49%            │
│  Divisional: 51%                │
├─────────────────────────────────┤
│  MILESTONES                     │
│  Longest win streak: 11         │
│  Best week: Goaltending (82%)   │
│  Lessons completed: 12/24       │
└─────────────────────────────────┘
```

**Surfaces rarely, and positively:**
- Milestone celebrations: "You just hit 70% on goaltending picks"
- Never: "Watch out, this is your blind spot"

---

## Visual Direction

**The feel:** Smart, clean, confident. The Athletic meets Duolingo's clarity.

**Principles:**
1. **Clean over cluttered** - One thing per screen does the heavy lifting
2. **Warm, not cold** - Dark mode with warmer accents (not cold Bloomberg blue)
3. **Progress is visible** - Week progress, IQ score, streaks celebrated
4. **Typography does the work** - Clear hierarchy, bold labels, minimal decoration
5. **Subtle icons** - Designed icon set, not emojis

**Visual language:**
- Bold labels for factor names (GOALIE EDGE, HOME ICE, REST)
- Color coding for advantage (teal/green for favored side)
- Checkmarks/X marks for results
- Subtle animations for milestones and level-ups

---

## First-Run Experience

**30 seconds, 4 screens:**

**Screen 1: The Hook**
> "Become a hockey expert.
> Learn what actually decides NHL games - and prove it by predicting them."

**Screen 2: How It Works**
> "Every game, we break down what matters.
> You read. You pick. You learn.
> Each week focuses on one concept. Your accuracy goes up as your knowledge grows."

**Screen 3: Your First Pick**
> Show an actual game breakdown. User makes their first pick.

**Screen 4: You're In**
> "Your first pick is locked.
> This week you're learning: Goaltending
> Check back after the game. We'll show you what happened and what you can learn from it."

**Key points:**
- Real pick during onboarding (investment)
- Frames the app correctly: learn → pick → grow
- No account required to start

---

## What Success Looks Like

**User after 1 week:**
- Made picks every day
- Understands that week's theme
- Can explain one hockey concept they didn't know before

**User after 1 month:**
- Accuracy has improved
- Has explored Coach's Corner
- Checks Factor Leaderboard to see what's predictive
- Feels smarter about hockey

**User after 1 season:**
- Thinks about hockey differently
- Understands advanced concepts (xG, possession, matchups)
- Has a track record they're proud of
- Tells friends about the app

---

## Implementation Considerations

### What Can Be Reused
- NHL API integration (games, teams, players, stats)
- Core prediction logic and factor calculations
- Team/Player data screens (reframed as research tools)
- Basic pick tracking

### What Needs Building
- Weekly theme system and content
- Breakdown generation for each game
- Results analysis ("what actually mattered")
- Coach's Corner content library
- Factor Leaderboard tracking
- New navigation and UI components
- Onboarding flow

### Content Needs
- 20-30 Coach's Corner lessons
- Weekly theme introductions (can follow a template)
- Factor explanations and "Go Deeper" content

---

## Open Questions

1. **AI benchmark:** Do we still show "PuckIQ says X%" or remove AI comparison entirely?
2. **Off-season:** What happens when there are no games?
3. **Notifications:** What brings users back? Weekly recap? Daily reminder?
4. **Social:** Any sharing features? Shareable result cards?
5. **Model builder:** Keep as advanced feature or cut entirely?

---

## Next Steps

1. Validate design with user testing (if desired)
2. Create detailed implementation plan
3. Design high-fidelity mockups
4. Prioritize MVP features vs future additions
5. Begin implementation
