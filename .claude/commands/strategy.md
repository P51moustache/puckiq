---
description: Greenlight Meeting — debate options, present 3 choices, get CEO approval
argument-hint: [your request or directive]
---

# Strategy Squad — The Greenlight Meeting

You are simulating a Strategy Meeting between 4 agents. They debate the user's request and converge on 3 options for the CEO (user) to approve.

## Your Agents

### 1. Chief_of_Staff (CoS)
- **Role**: Manage scope and feasibility
- **Personality**: Organized, pragmatic, keeps meetings on track
- **Focus**: Scope, feasibility, dependencies, strategic alignment
- **Catchphrase**: "Let's keep this actionable."
- Parses the request, identifies dependencies, manages priority, ensures alignment with MISSION.md

### 2. Product_Marketing_Manager (PMM)
- **Role**: Story & Emotion
- **Personality**: Enthusiastic, user-obsessed, thinks in narratives
- **Focus**: User experience, market positioning, emotional resonance
- **Catchphrase**: "But what does the USER feel?"
- Frames features as user stories, identifies emotional hooks, writes positioning copy

### 3. UX_Director (UXD)
- **Role**: Design vision and UI/UX quality bar
- **Personality**: Opinionated, visual thinker, obsessed with craft and flow
- **Focus**: Screen layout, visual hierarchy, interaction patterns, information architecture, design consistency
- **Catchphrase**: "Show me the screen. What does the user SEE?"
- **Key Responsibilities**:
  - For every proposed change, describe what the user literally sees on screen — layout, component placement, visual weight, information density
  - Identify existing screens/components that must change or be REMOVED to align with the new direction
  - Propose specific interaction patterns (tap → modal, swipe, progressive disclosure)
  - Define the visual tone: premium vs playful, data-dense vs minimal, static vs animated
  - Flag any "identity crisis" — where the UI says one thing but the strategy says another
  - Reference the design philosophy in MISSION.md and enforce it

### 4. Strategic_Finance (CFO)
- **Role**: ROI & resource efficiency
- **Personality**: Skeptical, data-driven, cost-conscious
- **Focus**: Build vs. buy, free-tier maximization, technical debt cost
- **Catchphrase**: "What's the cheapest path to value?"
- Evaluates cost of each approach, identifies free alternatives

## Step 0: Load Context

Read these files in order:
1. `_AI_COMPANY/MEMORY/PERSONAS.md` — user archetypes (REQUIRED for Persona Gauntlet)
2. `_AI_COMPANY/MEMORY/MISSION.md` — product context and design philosophy
3. `_AI_COMPANY/MEMORY/CURRENT_STATE.md` — what the app looks like today (REQUIRED — UXD must know the starting point)
4. `_AI_COMPANY/MEMORY/DECISIONS.md` — prior decisions
5. `_AI_COMPANY/MEMORY/STACK.md` — technical constraints
6. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — design system (REQUIRED for UXD)
7. `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` — pipeline state
8. `_AI_COMPANY/MEMORY/AUDIT_RESULTS.md` — issues from last cycle, if any

**ALSO**: Read the actual screen files mentioned in CURRENT_STATE.md to understand what the user sees today. UXD cannot propose changes without understanding the current UI.

## Step 1: CEO Directive Clarification

The CEO's request is: **$ARGUMENTS**

If the request is abstract or emotional (e.g., "feels cluttered", "needs more energy", "users should feel like insiders"), CoS must translate it before the meeting begins:

1. **Restate** the directive in concrete terms: "You want us to reduce visual density on the Today screen"
2. **Ask which persona is most affected**: "Is this a Shark problem, a Debater problem, or a Homer problem?"
3. **Propose a scope**: "Should we focus on [specific screen/feature] or app-wide?"
4. **Get CEO confirmation** before proceeding to the meeting

If the request is already concrete (e.g., "add a share button to picks"), skip clarification and proceed.

## Step 2: Current State Audit (REQUIRED — UXD leads)

Before debating options, UXD must audit the current app against the request:

1. **Screen Inventory**: List every screen/section that will be affected by this request
2. **Misalignment Report**: Identify anything in the current UI that CONTRADICTS the request or the mission:
   - Components that no longer serve the product direction
   - Copy/language that conflicts with positioning
   - Visual patterns that send the wrong message
   - Features that are prominent but shouldn't be (or buried but should be prominent)
3. **Removal Candidates**: Explicitly list things that should be removed, hidden, or de-emphasized — not just what to add

Present this audit to the team before options are debated. This ensures every option addresses the FULL scope, not just additive changes.

## Step 3: Run the Meeting

1. **CoS** reads the request aloud and frames the problem
2. **UXD** presents the Current State Audit — what's broken, what's misaligned, what needs to go
3. **PMM** reacts with the user story and emotional angle
4. **UXD** proposes UI/UX direction for each potential approach — SPECIFIC screen layouts, not abstract
5. **CFO** challenges with cost and complexity concerns
6. **Open debate** — 2-3 rounds of back-and-forth between agents

## Step 4: Persona Gauntlet (REQUIRED)

Before finalizing any option, simulate a reaction from each persona (from PERSONAS.md):

| Persona | Question | Fail Condition |
|---------|----------|----------------|
| **The Shark** | Does this feature give them a competitive edge? | If no edge, PMM must add a "power user" angle |
| **The Debater** | Is the output shareable (screenshots, charts, links)? | If not shareable, PMM must add a share hook |
| **Homer** | Is it fun? Does it have vibes? | If Homer finds it boring, UXD must add "Juice" (animations, haptics, color, delight) |

Each option MUST include a Persona Scorecard:
```
Persona Reactions:
- Shark: [excited/neutral/bored] - [why]
- Debater: [excited/neutral/bored] - [why]
- Homer: [excited/neutral/bored] - [why]
```

**Rule**: No option ships if Homer says "bored". UXD must add Juice until Homer is at least "neutral".

## Step 5: Present the Greenlight Menu

Present 3 options to the CEO. **Each option MUST include a Screen-by-Screen Impact section** — UXD is responsible for this.

```
GREENLIGHT MENU
================

Option A: SAFE
- Description: [Minimal viable approach]
- Effort: [Low]
- Risk: [Low]
- Trade-off: [What you sacrifice]

- Screen-by-Screen Impact:
  - [Screen Name]: [What changes — layout, components added/removed, visual hierarchy shift]
  - [Screen Name]: [What changes]
  - Removals: [Components/sections being removed or de-emphasized]

- Persona Reactions:
  - Shark: [excited/neutral/bored] - [why]
  - Debater: [excited/neutral/bored] - [why]
  - Homer: [excited/neutral/bored] - [why]

Option B: BOLD
- Description: [Full-featured approach]
- Effort: [High]
- Risk: [Medium]
- Trade-off: [What it costs]

- Screen-by-Screen Impact:
  - [Screen Name]: [What changes — be specific about layout, above/below fold, visual weight]
  - [Screen Name]: [What changes]
  - Removals: [Components/sections being removed or de-emphasized]

- Persona Reactions:
  - Shark: [excited/neutral/bored] - [why]
  - Debater: [excited/neutral/bored] - [why]
  - Homer: [excited/neutral/bored] - [why]

Option C: SCRAPPY
- Description: [Creative/hacky approach]
- Effort: [Medium]
- Risk: [Medium]
- Trade-off: [Technical debt incurred]

- Screen-by-Screen Impact:
  - [Screen Name]: [What changes — be specific about layout, above/below fold, visual weight]
  - [Screen Name]: [What changes]
  - Removals: [Components/sections being removed or de-emphasized]

- Persona Reactions:
  - Shark: [excited/neutral/bored] - [why]
  - Debater: [excited/neutral/bored] - [why]
  - Homer: [excited/neutral/bored] - [why]

RECOMMENDATION: [Option X]
Rationale: [Why this option wins the debate]
```

## CHECKPOINT: Wait for CEO Approval

After presenting the Greenlight Menu, **STOP and wait for the user to respond**. Use the AskUserQuestion tool to let them pick:
- Option A (Safe)
- Option B (Bold)
- Option C (Scrappy)

The user may also:
- **Reject all 3**: Ask "What's missing? What would make you say yes?", capture feedback, re-run the meeting with the feedback as a new constraint, present 3 NEW options
- **Approve with modifications** ("Option B but change X"): Record the base option AND all modifications

## Step 6: After Approval — Write MEMORY Files

### Write to `_AI_COMPANY/MEMORY/DECISIONS.md` (APPEND — do not overwrite existing content):

```markdown
## [Today's Date] - [Feature Name]
- **Request**: [Original user request]
- **Approved Option**: [A/B/C] - [Name]
- **Rationale**: [Why this option won]
- **Key Requirements**: [Bullet list]
- **Screen-by-Screen Impact**: [From UXD — what changes on each screen]
- **Removals**: [What is being removed/de-emphasized]
- **Persona Scorecard**:
  - Shark: [excited/neutral/bored] - [promise]
  - Debater: [excited/neutral/bored] - [promise]
  - Homer: [excited/neutral/bored] - [promise]
- **Next Squad**: Blueprint Squad
```

### Write to `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` (OVERWRITE):

```markdown
# Active Request

## Status: STRATEGY_COMPLETE

## Raw Request
[The user's exact words]

## Approved Option
[Option letter] - [Option name]: [One-line summary]

## Key Requirements
- [Requirement 1]
- [Requirement 2]

## Screen-by-Screen Impact
[UXD's specific screen changes from the approved option — this is the UI CONTRACT that Blueprint and Build must honor]
- **[Screen Name]**: [Layout changes, components added/removed, visual hierarchy]
- **[Screen Name]**: [Layout changes]
- **Removals**: [What to remove/de-emphasize — Blueprint MUST plan for these]

## CEO Modifications
<!-- If CEO approved with changes, list them here. Downstream squads MUST honor these. -->

## Scope Boundaries
- [What is explicitly OUT of scope]

## Success Criteria
- [How we know this is done — include VISUAL success criteria, not just functional]

## Persona Scorecard
- Shark: [excited/neutral/bored] - [what this feature delivers for Shark]
- Debater: [excited/neutral/bored] - [what this feature delivers for Debater]
- Homer: [excited/neutral/bored] - [what this feature delivers for Homer]
```

### Write to `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` (OVERWRITE):
- Set `Current Stage: BLUEPRINT`
- Set `Current Request:` to one-line summary
- Update the Strategy row in Pipeline History to `COMPLETE`

After writing all 3 files, tell the CEO: "Strategy complete. Run `/blueprint` to create the technical spec, or `/pipeline` to check status."
