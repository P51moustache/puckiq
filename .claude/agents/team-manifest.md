# PuckIQ Agent Team — Manifest

## Overview

9-agent team for PuckIQ development. Operates as a **parallel, message-driven workflow** — not a sequential pipeline. Agents collaborate simultaneously, coordinate via messages and shared MEMORY files.

## Team

| Agent | Model | Domain | Owns (MEMORY) |
|-------|-------|--------|---------------|
| `ceo-orchestrator` | Opus | Strategy, coordination, decisions | DECISIONS.md, MISSION.md |
| `product-manager` | Opus | Requirements, specs, personas | ACTIVE_REQUEST.md, PERSONAS.md, TECHNICAL_SPEC.md |
| `ux-designer` | Sonnet | Design specs, visual QA, copy | STYLE_GUIDE.md, CURRENT_STATE.md |
| `frontend-engineer` | Sonnet | React Native screens + components | IMPLEMENTATION_LOG.md (shared) |
| `backend-engineer` | Sonnet | Services, APIs, data layer | SCHEMA.sql, real_data_sources.md |
| `devops-engineer` | Sonnet | Builds, deps, docs, infra | STACK.md, FILE_MAP.md, PIPELINE_STATUS.md |
| `qa-tester` | Sonnet | Tests, fixtures, code quality | AUDIT_RESULTS.md (shared) |
| `security-reviewer` | Opus | Security, compliance, analytics | AUDIT_RESULTS.md (shared) |
| `performance-optimizer` | Sonnet | Startup speed, renders, bundle size | None (reports to CEO) |

## How to Spawn This Team

```
1. TeamCreate with team_name: "puckiq-dev"
2. Spawn all 9 agents via Task tool in parallel:
   - Each agent gets: name, team_name: "puckiq-dev", model (opus/sonnet per table above)
   - Use subagent_type: "general-purpose" for all agents
   - Use mode: "bypassPermissions" so agents can read/write freely
   - Use run_in_background: true
   - Paste the contents of .claude/agents/{role}.md as the prompt
3. Create tasks with TaskCreate, assign with TaskUpdate (owner: agent name)
4. Agents coordinate via SendMessage
```

## Workflow: Feature Lifecycle

```
1. CEO receives request
   ├── PM: write requirements + run Persona Gauntlet     ← parallel
   └── UX: audit current state + identify removals       ← parallel

2. Spec phase
   ├── PM: acceptance criteria, phased task breakdown
   ├── UX: Screen Design Specs, Copy Guide, animations
   └── CEO: review + present options (Safe/Bold/Scrappy) → user approves

3. Implementation (parallel tracks)
   ├── Backend: types → schema → services → API integration
   ├── Frontend: components → screens → animations (waits for UX specs)
   ├── QA: writes tests alongside implementation (TDD)
   ├── DevOps: deps, build health, config
   └── Perf: audit startup, renders, bundle — fix small, flag big

4. Review (parallel)
   ├── QA: test suite + coverage report
   ├── Security: vulnerability scan + compliance
   ├── UX: screenshot verification vs design specs
   ├── Perf: performance report with quick wins + big optimizations
   └── CEO: strategic alignment + persona promises

5. Ship
   ├── DevOps: update MEMORY files
   └── CEO: report to user
```

## Parallel vs Sequential

**Always parallel:**
- Backend services + Frontend scaffolding
- QA test writing + implementation
- Security review + QA code quality
- DevOps docs + any implementation
- Performance audit + any implementation

**Must wait:**
- Frontend implementation → waits for UX Screen Design Specs
- QA integration tests → waits for implementation to exist
- MEMORY file updates → waits for cycle completion

## Coordination Rules

1. **Handoff = message.** When you finish work another agent needs, SendMessage to them.
2. **No agent reads another agent's code without being asked.** Stay in your lane.
3. **Conflicts → CEO.** If two agents disagree, CEO decides.
4. **TaskList is truth.** Check it after completing each task. Claim next unblocked task.
5. **Tests before merge.** QA must confirm `npm test` passes before CEO signs off.

## Persona Gauntlet (PM runs, CEO enforces)

Every feature must pass before shipping:

| Persona | Core Need | Fail Condition |
|---------|-----------|---------------|
| **Shark** | Data edge, competitive advantage, custom models | If no edge → PM adds power-user angle |
| **Debater** | Shareable output, screenshot-friendly, quotable | If not shareable → UX adds share hooks |
| **Homer** | Fun, team colors, animations, vibes | If boring → UX adds "Juice" (animation, color, delight) |

**Rule:** No feature ships if Homer says "bored."

## Quality Gates (all must pass)

- [ ] `npm test` passes (all app tests green)
- [ ] `ml/.venv/bin/python -m pytest ml/tests/ -x -q` passes (all 284 ML tests green) — if ML code was touched
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Security: no critical/high findings
- [ ] **VISUAL VERIFICATION: Screenshots taken and reviewed** (see below)
- [ ] Screenshots match UX design specs
- [ ] Persona promises kept (Shark/Debater/Homer) — scored from screenshots, not code
- [ ] Strategic alignment: UI reflects MISSION.md, no identity crisis
- [ ] MEMORY files updated by DevOps

## MANDATORY: Visual Verification Protocol

**Every sprint that touches UI MUST include simulator screenshots.** Code reading alone is NEVER sufficient.

**Who must take screenshots:**
| Agent | When | What to Capture |
|-------|------|----------------|
| **Frontend Engineer** | After every UI code change | The changed component in-situ |
| **QA Tester** | During visual QA pass | Full page scroll-screenshots of every affected screen |
| **UX Designer** | After implementation complete | Compare against design spec, flag deviations |
| **Product Manager** | Before Persona Gauntlet | Full page screenshots to score each persona |

**How to take screenshots:**
```bash
# Single screenshot
xcrun simctl io booted screenshot /tmp/screenshot.png

# Navigate to a route first
xcrun simctl openurl booted "exp+learning-project://[route]"

# Scroll down (get UDID first)
UDID=$(xcrun simctl list devices booted -j | python3 -c "import json,sys; data=json.load(sys.stdin); [print(d['udid']) for rt in data['devices'].values() for d in rt if d['state']=='Booted']" | head -1)
idb ui swipe 196 650 196 100 --duration 0.5 --udid $UDID

# Then read the PNG with the Read tool to view it
```

**CEO enforces this:** If a UI-facing agent reports completion without screenshot evidence, CEO sends them back to take screenshots.

## Quick Reference

| Situation | Who |
|-----------|-----|
| New feature | CEO → PM → UX → Frontend + Backend → QA → Security → CEO |
| Bug fix | CEO → QA (reproduce) → Frontend/Backend (fix) → QA (verify) |
| Design issue | CEO → UX (audit) → Frontend (fix) → UX (verify screenshot) |
| Security issue | CEO → Security (audit) → Frontend/Backend (remediate) → Security (re-verify) |
| Build broken | CEO → DevOps (fix) → QA (verify tests pass) |
| Quick cosmetic fix | CEO → UX (spec) → Frontend (implement) → UX (screenshot verify) |
| Performance issue | CEO → Perf (audit) → Frontend/Backend (fix) → Perf (verify) |
| Update docs | CEO → DevOps |

## PuckIQ Codebase Quick Reference

```
app/(tabs)/           3 visible tabs + 2 hidden (file-based Expo Router)
  index.tsx           Upcoming screen (default tab — main analytics terminal)
  players.tsx         Players tab (league leaders, trending, projections)
  stats.tsx           Explore tab (lazy-loads teams.tsx, models.tsx)

components/           ~44 reusable UI components + subdirectories
  __tests__/          18 component test files, 82+ tests
  model-builder/      6 model builder components
  design-system/      Button, Card
  ui/                 SkeletonLoader, EmptyState, ErrorState

services/             15 business logic services
  __tests__/          5 service test files, 126+ tests
  pickTracking.ts     CRITICAL: pick calc + storage
  edgeStats.ts        NHL Edge IQ API client (5-min cache)
  derivedStats.ts     Momentum, Clutch, Rest, xG calculations
  gameResults.ts      Supabase H2H + game results
  insightGenerator.ts Analytical insight generation

constants/theme.ts    Design tokens — NEVER hardcode colors
lib/supabase.ts       Supabase client (env vars)
lib/firebase.ts       Firebase init
scripts/sync/         NHL data sync pipeline (GitHub Actions, 13 modules)
```

### ML Prediction Pipeline (`ml/`)

Separate Python codebase for NHL game prediction models. **Uses its own venv** (`ml/.venv/bin/python`, Python 3.13) — never use system Python for ML work.

```
ml/features/features.yaml    — Single source of truth for ALL ML features
ml/features/registry.py      — Loads YAML, get_model_features(), generate_synthetic_features()
ml/features/compute.py       — Computes features from Supabase data
ml/models/                   — game_winner.py, spread.py, totals.py, baselines.py
ml/evaluation/               — walk-forward CV, calibration, overfitting detection
ml/pipeline/                 — weekly_retrain.py, monthly_eval.py, daily_predict.py
ml/scripts/run_baselines.py  — Baseline evaluation
ml/dashboard/                — Streamlit dashboard (6 pages)
ml/config.py                 — All ML constants and hyperparameters
ml/tests/                    — 284 tests
```

**To add/remove ML features**: Only edit `features.yaml`. Tests and baselines auto-discover.
**To run ML tests**: `ml/.venv/bin/python -m pytest ml/tests/ -x -q`
**3 active models**: game_winner (23 features), spread (17), totals (14)

**Dashboard (HF Space)**: `ml/dashboard/` — Streamlit app deployed via Docker on Hugging Face Spaces (port 7860). After any ML feature/model/metric change, update the relevant dashboard page and redeploy. Feature descriptions in page 3 must match `features.yaml`.
