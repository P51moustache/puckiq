---
description: Send work back to a previous squad for revision
argument-hint: [squad#] [reason]
---

# Rework — Send Work Back

Send the current pipeline output back to a previous squad for revision.

## Step 0: Parse Arguments

Parse **$ARGUMENTS**:
- First token = squad number (1, 2, or 3)
- Remaining tokens = reason for rework

Valid targets:
- **1** = Strategy Squad (re-debate the options — requirements were wrong)
- **2** = Blueprint Squad (re-plan — spec is incomplete, design is shallow, or UI isn't specified)
- **3** = Execution Squad (re-build — implementation doesn't match spec or UI doesn't match design)

If the squad number is missing or invalid (not 1-3), ask the user: "Which squad should receive the rework? (1=Strategy, 2=Blueprint, 3=Execution)"

If the reason is missing, ask the user: "What's wrong? What needs to change?"

---

## Squad 1 Rework: Strategy

Re-run the Strategy Meeting with the rework reason as a new constraint.

### Load Context

Read these files:
1. `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` — the current approved option that needs rework
2. `_AI_COMPANY/MEMORY/PERSONAS.md` — user archetypes
3. `_AI_COMPANY/MEMORY/MISSION.md` — product context
4. `_AI_COMPANY/MEMORY/CURRENT_STATE.md` — what the app looks like today
5. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — design system
6. `_AI_COMPANY/MEMORY/DECISIONS.md` — prior decisions
7. `_AI_COMPANY/MEMORY/AUDIT_RESULTS.md` — if verification flagged issues (especially UX Auditor and Strategic Alignment)

### Rework Protocol

1. CoS reads the rework reason and the current ACTIVE_REQUEST
2. UXD audits the current state — what's misaligned, what was missed
3. Identify what went wrong with the original option
4. Re-run the meeting protocol with the rework reason as a NEW constraint
5. Present 3 NEW options — do not repeat the failed approach
6. Each option MUST include Screen-by-Screen Impact and Removals (UXD is responsible)
7. Run the Persona Gauntlet on all 3 new options
8. Wait for CEO approval (use AskUserQuestion)
9. After approval:
   - Overwrite `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` with new approved option (include Screen-by-Screen Impact, Removals, Persona Scorecard)
   - Append to `_AI_COMPANY/MEMORY/DECISIONS.md` with "[REWORK]" prefix
   - Set `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` Current Stage to `BLUEPRINT`, update Strategy row to `REWORK_COMPLETE`

---

## Squad 2 Rework: Blueprint

Revise the technical spec, keeping what works and fixing what doesn't.

### Load Context

Read these files:
1. `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` — the approved option (especially Screen-by-Screen Impact and Removals)
2. `_AI_COMPANY/MEMORY/TECHNICAL_SPEC.md` — the current spec that needs rework
3. `_AI_COMPANY/MEMORY/PERSONAS.md` — user archetypes
4. `_AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md` — if execution already started, what was built
5. `_AI_COMPANY/MEMORY/STACK.md` — technical constraints
6. `_AI_COMPANY/MEMORY/SCHEMA.sql` — existing schema
7. `_AI_COMPANY/MEMORY/MISSION.md` — product context
8. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — design system

**ALSO**: Read the actual screen files that will be affected. UXA cannot revise designs without seeing the current code.

### Rework Protocol

1. EPM reads the rework reason and the current TECHNICAL_SPEC
2. UXA reads the affected screen files and identifies design gaps
3. Identify what is wrong with the current spec — common issues:
   - Screen Design Specs were missing or too shallow
   - Copy Guide was incomplete
   - Removal tasks were missing
   - Acceptance criteria didn't include visual outcomes
   - Phase checkpoints were insufficient
4. Revise the spec, keeping what works and fixing what does not
5. Add a `## Rework Changes` section at the top of TECHNICAL_SPEC.md clearly marking what changed and why
6. Ensure every screen has a detailed Screen Design Spec (layout diagram, component specs, copy guide, interactions, animations, removals)
7. Update `_AI_COMPANY/MEMORY/SCHEMA.sql` if schema changes needed
8. Update `_AI_COMPANY/MEMORY/FILE_MAP.md` if file plan changed
9. Set `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` Current Stage to `EXECUTION`, update Blueprint row to `REWORK_COMPLETE`

---

## Squad 3 Rework: Execution

Fix specific issues in the implementation without rebuilding from scratch.

### Load Context

Read these files:
1. `_AI_COMPANY/MEMORY/TECHNICAL_SPEC.md` — the spec to build against (especially Screen Design Specs)
2. `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md` — original request and Screen-by-Screen Impact
3. `_AI_COMPANY/MEMORY/PERSONAS.md` — user archetypes
4. `_AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md` — what was already built
5. `_AI_COMPANY/MEMORY/AUDIT_RESULTS.md` — if verification flagged issues (especially UX Auditor report)
6. `_AI_COMPANY/MEMORY/MISSION.md` — product mission
7. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — design system
8. `_AI_COMPANY/MEMORY/STACK.md` — technology stack

**ALSO**: Read the actual code files that need fixing.

### Rework Protocol

1. Builder reads the rework reason and the AUDIT_RESULTS/IMPLEMENTATION_LOG
2. Fix the specific issues identified — do NOT rebuild from scratch unless the rework reason requires it
3. Follow all Build Constraints (testID, logEvent, TypeScript strict, theme compliance, service layer pattern, Copy Guide compliance, removal compliance)
4. If the rework involves UI changes:
   - Take a screenshot after each fix: `xcrun simctl io booted screenshot /tmp/rework_[name].png`
   - Read the screenshot and verify it matches the Screen Design Spec
   - Verify strategic alignment — no identity crisis
5. Update `_AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md` with a `## Rework` section describing fixes
6. Update `_AI_COMPANY/MEMORY/FILE_MAP.md` if files were added/removed
7. Set `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` Current Stage to `VERIFICATION`, update Execution row to `REWORK_COMPLETE`

---

After completing any rework, tell the user which squad was reworked, what changed, and what command to run next.
