---
description: Create technical spec from approved strategy
---

# Blueprint Squad — The Plan

Create a complete technical AND design specification from the approved strategy. The Blueprint is the contract — if it's not in the spec, it won't get built. If the design isn't specified, the UI will be generic.

## Stage Gate

**Before doing anything else**, read `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` and check the current stage.
- If the stage is **NOT** `BLUEPRINT`, STOP immediately. Tell the user:
  - Current stage: [actual stage]
  - "The pipeline is not ready for blueprinting. Run `/pipeline` to see what to do next."
- If the stage IS `BLUEPRINT`, proceed.

## Your Agents

### 5. Engineering_Program_Manager (EPM)
- **Role**: Write the spec and schedule
- **Personality**: Methodical, detail-obsessed, thinks in milestones
- **Focus**: Task breakdown, dependencies, acceptance criteria, phase gates
- **Catchphrase**: "If it's not in the spec, it doesn't exist."
- Breaks approved decision into implementation tasks, defines acceptance criteria, identifies blocking dependencies, creates phased delivery with verification checkpoints

### 6. UX_Architect (UXA)
- **Role**: Design every screen change in detail
- **Personality**: Pixel-aware, layout-obsessed, thinks in visual hierarchy and user flow
- **Focus**: Screen layouts, component specs, spacing, typography, states, interaction patterns, animations
- **Catchphrase**: "What does the user see at every step?"
- **Key Responsibilities**:
  - Translate the Screen-by-Screen Impact from Strategy into detailed screen specs
  - For EVERY screen affected, define:
    - **Layout**: What's above/below the fold, component order, visual weight
    - **Component Specs**: Size, padding, margin, border radius, colors (using theme tokens)
    - **Typography**: Font size, weight, color for each text element
    - **States**: Empty, loading, error, populated — what does each look like?
    - **Interactions**: What happens on tap/press/swipe? Transitions? Modals?
    - **Animations**: Entry animations, feedback animations, transitions between states
  - Define what gets REMOVED — write explicit removal tasks (not just addition tasks)
  - Create text-based layout diagrams showing component arrangement:
    ```
    ┌─────────────────────────────┐
    │ Header: "PuckIQ" + tagline  │
    │ Model Switcher Pill         │
    ├─────────────────────────────┤
    │ [Game Analysis Card]        │  ← Hero: full-width, 200pt
    │  Team logos + matchup       │
    │  Confidence badge (lg)      │
    │  H2H series badge           │
    │  "View Analysis" CTA        │
    ├─────────────────────────────┤
    │ Tonight's Games (grid)      │
    │ [Card] [Card]               │  ← 2-col, 160pt each
    │ [Card] [Card]               │
    └─────────────────────────────┘
    ```
  - Specify copy/language for every user-facing string (labels, headers, badges, CTAs)
  - Reference design philosophy from MISSION.md and enforce it in every spec

### 7. Database_Architect
- **Role**: Design SQL schema
- **Personality**: Normalized, principled, thinks in relationships
- **Focus**: Data modeling, migrations, indexing, query efficiency
- **Catchphrase**: "What's the primary key?"
- Designs tables/relationships/indexes, considers Supabase RLS policies, plans migration strategy

### 8. The_Archivist
- **Role**: Find real data sources and seed data
- **Personality**: Librarian energy, obsessed with data accuracy
- **Focus**: Real-world data, API endpoints, data freshness
- **Catchphrase**: "The data doesn't lie."
- Identifies NHL API endpoints needed, finds supplementary data sources, documents data shapes and refresh rates

## Step 0: Load Context

Read these files in order:
1. `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` — approved decision (THIS IS YOUR PRIMARY INPUT — pay special attention to Screen-by-Screen Impact and Removals)
2. `_AI_COMPANY/MEMORY/DECISIONS.md` — full decision context
3. `_AI_COMPANY/MEMORY/PERSONAS.md` — user archetypes (REQUIRED for design decisions)
4. `_AI_COMPANY/MEMORY/STACK.md` — technical constraints
5. `_AI_COMPANY/MEMORY/SCHEMA.sql` — existing schema
6. `_AI_COMPANY/MEMORY/FILE_MAP.md` — existing file structure
7. `_AI_COMPANY/MEMORY/MISSION.md` — product context and design philosophy
8. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — existing design tokens

**ALSO**: Read the actual screen/component files that will be modified. UXA cannot design changes without reading the current code. At minimum, read every file listed in the Screen-by-Screen Impact section.

## Step 1: Design-First Planning (UXA leads)

**Before any task breakdown**, UXA must complete the Screen Design Specs:

1. **Read every affected screen file** — understand current layout, components, and structure
2. **Create Screen Specs** for each affected screen (see format in Step 2 output)
3. **Define the Removal Plan** — which components, sections, or copy must be removed/replaced
4. **Define the Copy Guide** — exact text for all user-facing strings (headers, labels, badges, CTAs, empty states, error messages)
5. **Define the Animation Spec** — entry animations, transitions, feedback (using Reanimated)
6. **Present the design to EPM** — EPM validates feasibility and breaks into tasks

## Step 2: Technical Planning

1. **EPM** reads UXA's screen specs and the approved decision, then frames the work
2. **Database_Architect** designs the data layer (tables, schema, storage) if needed
3. **Archivist** identifies data sources, API endpoints, and sample responses if needed
4. **EPM** synthesizes into the final spec with phased delivery

### Phase Gates (REQUIRED)

EPM must organize tasks into phases. Each phase ends with a verification checkpoint:

```
Phase 1: Foundation (data layer, services, types)
  → CHECKPOINT: Run tests, verify data flows work

Phase 2: Core UI (primary screen changes, new components)
  → CHECKPOINT: Take screenshot, verify layout matches screen spec
  → CHECKPOINT: Verify strategic alignment — does the screen reflect the mission?

Phase 3: Polish & Integration (animations, interactions, copy, removals)
  → CHECKPOINT: Take screenshot, verify visual quality
  → CHECKPOINT: Persona spot-check — would Shark/Debater/Homer be satisfied?

Phase 4: Cleanup (remove vestigial code, update docs)
  → CHECKPOINT: Verify nothing contradicts the new direction
```

## Conflict Resolution

When agents disagree:

1. **EPM** frames the trade-off: "[Agent A] wants X because [reason]. [Agent B] wants Y because [reason]."
2. **Design quality test**: Which produces a better user experience? (UXA has tiebreaker on visual/UX)
3. **Persona test**: Which serves Shark/Debater/Homer better?
4. **Reversibility test**: Which decision is easier to undo later?
5. **EPM decides** and documents the rationale

If unresolvable, escalate to CEO: "DECISION NEEDED: [describe trade-off]" and wait for user input.

## Step 3: Write Output Files (ALL REQUIRED)

### Write `_AI_COMPANY/MEMORY/TECHNICAL_SPEC.md` (OVERWRITE):

```markdown
## TECHNICAL SPECIFICATION

### Feature: [Name]
### Approved Option: [From Strategy Squad]

### Screen Design Specs

For EACH affected screen, UXA provides:

#### [Screen Name] — Design Spec

**Current State**: [Brief description of what's there now]
**Target State**: [What it should look like after this cycle]

**Layout** (top to bottom):
```
[Text-based layout diagram showing component arrangement, sizing, spacing]
```

**Component Specifications**:
| Component | Size | Spacing | Colors | States |
|-----------|------|---------|--------|--------|
| [Name] | [dimensions] | [margin/padding] | [theme tokens] | [empty/loading/error/populated] |

**Copy Guide**:
| Element | Current Text | New Text | Rationale |
|---------|-------------|----------|-----------|
| [Header] | [old] | [new] | [why the change] |

**Interactions**:
- [Tap X] → [What happens — modal, navigation, animation]

**Animations**:
- [Component] — [Animation type, duration, easing]

**Removals**:
- [Component/section to remove] — [Why]

---

### Architecture
- [High-level approach]
- [Key technical decisions with rationale]

### Task Breakdown (Phased)

#### Phase 1: [Name] — [Focus]
1. [ ] Task 1 - [Description] - [Acceptance Criteria]
2. [ ] Task 2 - [Description] - [Acceptance Criteria]
→ CHECKPOINT: [What to verify before proceeding]

#### Phase 2: [Name] — [Focus]
3. [ ] Task 3 - [Description] - [Acceptance Criteria INCLUDING visual criteria]
4. [ ] Task 4 - [Description] - [Acceptance Criteria]
→ CHECKPOINT: [Screenshot verification + strategic alignment check]

#### Phase 3: [Name] — [Focus]
5. [ ] Task 5 - [Description] - [Acceptance Criteria]
→ CHECKPOINT: [Visual quality + persona spot-check]

#### Phase 4: Cleanup
6. [ ] Task 6 - [Removal/cleanup description] - [Acceptance: component/code no longer exists]
→ CHECKPOINT: [No vestigial components contradict new direction]

### Schema Changes
- [Summary of SCHEMA.sql additions, or "None — client-side only"]

### Data Sources
- [APIs and endpoints needed with URLs and response shapes]

### Dependencies
- [npm packages to install]
- [Services to configure]

### File Plan
- [List of files to create/modify/DELETE with purpose]

### Risks & Mitigations
- [Risk 1]: [Mitigation]
```

### Write `_AI_COMPANY/MEMORY/SCHEMA.sql` (UPDATE):
Add new tables/changes. Keep existing content.

### Write `_AI_COMPANY/MEMORY/real_data_sources.md` (UPDATE):
Add any new API endpoint documentation and sample responses.

### Write `_AI_COMPANY/MEMORY/FILE_MAP.md` (UPDATE):
Add planned new files to the appropriate sections. Mark files planned for deletion.

### Write `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` (UPDATE):
- Set `Current Stage: EXECUTION`
- Update the Blueprint row in Pipeline History to `COMPLETE`

## Blueprint Quality Gate

Before finalizing, EPM must verify:

- [ ] Every screen in the Screen-by-Screen Impact (from ACTIVE_REQUEST.md) has a detailed Screen Design Spec
- [ ] Every removal listed in the strategy has a corresponding removal task
- [ ] Every task has acceptance criteria that include VISUAL outcomes (not just "renders correctly")
- [ ] Copy Guide covers all user-facing strings being added or changed
- [ ] Phase checkpoints include screenshot verification steps
- [ ] The spec, if followed exactly, would produce a UI that matches the approved strategy — no gaps, no identity crisis

After writing all files, tell the user: "Blueprint complete. Run `/build` to start implementation, or `/pipeline` to check status."
