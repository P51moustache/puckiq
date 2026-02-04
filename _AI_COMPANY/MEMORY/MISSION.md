# PUCK-IQ Mission

## What We're Building
PuckIQ is a React Native/Expo NHL hockey analytics and smart predictions app. It gives fans data-driven game picks, streaks, and insights — without being a betting app.

## Target User
Hockey fans who want to feel smarter about the game. They care about stats but don't want to dig through spreadsheets. They want a polished, opinionated app that says "pick this team tonight, here's why."

## Core Value Props
1. **Smart Picks** - AI-weighted predictions for tonight's games
2. **Streak Tracking** - Daily engagement loop (visit streaks, pick accuracy)
3. **Model Builder** - Let users create and backtest their own prediction models
4. **Learn** - Educate fans on hockey analytics concepts

## Design Philosophy
- Dark mode, premium feel (think ESPN meets Apple)
- Data-dense but not overwhelming
- Opinionated — we make the pick, user decides to follow or not
- Mobile-first, but works on web

## Business Constraints
- Zero budget: free-tier everything (Supabase, Firebase, NHL API)
- No gambling features or language — this is analytics, not betting
- NHL API is unofficial — no guaranteed uptime or SLA
- Solo developer — scope must stay manageable

## Brand Voice
- Confident, not cocky. We state our pick and show our math.
- Insider language welcome — don't dumb it down, but don't gatekeep.
- Concise over verbose. If it takes a paragraph, it should be a chart.

## Emotional Promise
- After using PuckIQ, the user should feel: **smarter than their friends about hockey**
- The app should feel like a well-connected friend who works in hockey analytics

## Anti-Patterns (Never Ship)
- Spreadsheet energy — walls of numbers with no hierarchy or opinion
- "Just scores" — if ESPN already shows it better, don't duplicate it
- Betting language — no odds, no spreads, no "locks" (we say "picks" and "confidence")
- Feature bloat — if it doesn't serve Shark, Debater, or Homer, cut it

## Current Version: 2.1.0
- 5 tabs: Today, Explore, Models, Learn, My IQ
- Pick tracking with accuracy history
- Streak system with milestones
- Firebase analytics
- Supabase auth (in progress)
