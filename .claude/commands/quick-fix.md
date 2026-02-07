---
description: Small 1-3 file changes, skip the full pipeline
argument-hint: [description of the quick fix]
---

# Quick Fix — Skip Pipeline

For small, cosmetic, or trivial changes that do not need the full 5-squad pipeline. Examples: change a color, resize a button, tweak copy, fix spacing, correct a typo.

## Step 0: Load Context

Read these files:
1. `_AI_COMPANY/MEMORY/CURRENT_STATE.md` — what the app looks like today
2. `_AI_COMPANY/MEMORY/STYLE_GUIDE.md` — design tokens and patterns
3. `_AI_COMPANY/MEMORY/STACK.md` — technology stack
4. `_AI_COMPANY/MEMORY/PERSONAS.md` — make sure the fix does not break persona promises
5. `_AI_COMPANY/MEMORY/MISSION.md` — product mission (verify alignment)

## Step 1: Scope Check

The CEO's request is: **$ARGUMENTS**

Identify the exact files to change. This should be **1-3 files max**.

**HARD STOP**: If this change affects more than 3 files or requires new services/components, STOP and tell the user: "This needs the full pipeline. Run `/strategy [your request]` instead."

## Step 2: Make the Change

Implement the fix directly. Follow the same build constraints as the Execution Squad:
- Use theme constants (never hardcode colors)
- testID on any new interactive elements
- logEvent on any new user actions
- TypeScript strict (no `any`)
- Error handling on async operations
- Copy must align with product mission and positioning

## Step 3: Verify the Change

If the change affects what the user sees:
1. Take a screenshot: `xcrun simctl io booted screenshot /tmp/quickfix_before.png` (before the change, if possible)
2. Make the change
3. Take a screenshot: `xcrun simctl io booted screenshot /tmp/quickfix_after.png`
4. Read both screenshots and confirm the change looks correct
5. Verify strategic alignment — does this change reinforce or contradict the product mission?

## Step 4: Persona Spot-Check

Briefly verify the fix does not break persona promises:
- **Shark**: Does this reduce access to data or power-user features? If yes, reconsider.
- **Debater**: Does this make anything less shareable or screenshot-friendly? If yes, reconsider.
- **Homer**: Does this remove vibes, animations, or delight? If yes, reconsider.

If a persona concern is found, flag it to the CEO before proceeding.

## Step 5: Log the Change

### Append to `_AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md` (APPEND — do not overwrite):

Add a section:
```markdown
## Quick Fix - [Today's Date]
- **Request**: [What the CEO asked for]
- **Files Changed**: [List]
- **What Changed**: [Brief description]
- **Screenshot Verified**: [YES/NO]
```

### Update `_AI_COMPANY/MEMORY/CURRENT_STATE.md` if the change affects what the user sees.

After completing, tell the user what was changed and where. No need to advance the pipeline stage.
