#!/bin/bash

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
MAGENTA='\033[35m'
RESET='\033[0m'

MEMORY_DIR="_AI_COMPANY/MEMORY"
ROLES_DIR="_AI_COMPANY/ROLES"

# Show current pipeline status
echo ""
echo "${BOLD}===========================================${RESET}"
echo "${BOLD}${CYAN}  PUCK-IQ AGENCY (17-AGENT MODE)${RESET}"
echo "${BOLD}  Pure Claude - Markdown Driven${RESET}"
echo "${BOLD}===========================================${RESET}"
echo ""

# Read and display current pipeline stage
if [ -f "$MEMORY_DIR/PIPELINE_STATUS.md" ]; then
  STAGE=$(grep "^## Current Stage:" "$MEMORY_DIR/PIPELINE_STATUS.md" | sed 's/## Current Stage: //')
  REQUEST=$(grep "^## Current Request" -A 1 "$MEMORY_DIR/PIPELINE_STATUS.md" | tail -1)
  echo "${DIM}Pipeline Stage:${RESET} ${YELLOW}${STAGE}${RESET}"
  if [ -n "$REQUEST" ] && [ "$REQUEST" != "<!-- One-line summary of what's being worked on -->" ]; then
    echo "${DIM}Active Request:${RESET} ${REQUEST}"
  fi
  echo ""
fi

echo "Select a Squad to Activate:"
echo ""
echo "  ${GREEN}1)${RESET} Strategy Squad     ${DIM}CoS, PMM, HI Designer, CFO${RESET}"
echo "     ${DIM}Start here. Debate the request, pick an option.${RESET}"
echo ""
echo "  ${GREEN}2)${RESET} Blueprint Squad    ${DIM}EPM, Scrappy, DB Architect, Archivist${RESET}"
echo "     ${DIM}Reads: ACTIVE_REQUEST. Writes: TECHNICAL_SPEC, SCHEMA.${RESET}"
echo ""
echo "  ${GREEN}3)${RESET} Execution Squad    ${DIM}UI Designer, Builder, Fixture Manager${RESET}"
echo "     ${DIM}Reads: TECHNICAL_SPEC. Writes: code + IMPLEMENTATION_LOG.${RESET}"
echo ""
echo "  ${GREEN}4)${RESET} Verification Squad ${DIM}Test Engineer, SecOps, QA, Legal${RESET}"
echo "     ${DIM}Reads: IMPLEMENTATION_LOG + TECHNICAL_SPEC. Writes: AUDIT_RESULTS.${RESET}"
echo ""
echo "  ${GREEN}5)${RESET} Ops Squad          ${DIM}SysAdmin, Data Detective, HR Director${RESET}"
echo "     ${DIM}Reads: AUDIT_RESULTS. Fixes issues, updates MEMORY.${RESET}"
echo ""
echo "  ${MAGENTA}q!)${RESET} Quick Fix         ${DIM}Skip full pipeline for small/cosmetic changes${RESET}"
echo "     ${DIM}Reads: CURRENT_STATE + STYLE_GUIDE. Direct build + verify.${RESET}"
echo ""
echo "  ${GREEN}r)${RESET}  ${DIM}Rework (send output back to a previous squad)${RESET}"
echo "  ${GREEN}s)${RESET}  ${DIM}Show pipeline status${RESET}"
echo "  ${GREEN}q)${RESET}  ${DIM}Quit${RESET}"
echo ""
read -p "Deploy Squad (1-5, q!, r, s, q): " choice
echo ""

case $choice in
  1)
    echo "${CYAN}Deploying Strategy Squad...${RESET}"
    claude -p "$(cat <<'PROMPT'
Read the following files in order, then start the Greenlight meeting:
1. _AI_COMPANY/ROLES/01_STRATEGY_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes - REQUIRED for Persona Gauntlet)
3. _AI_COMPANY/MEMORY/MISSION.md (product context)
4. _AI_COMPANY/MEMORY/CURRENT_STATE.md (what the app looks like today - REQUIRED for translating CEO directives)
5. _AI_COMPANY/MEMORY/DECISIONS.md (prior decisions)
6. _AI_COMPANY/MEMORY/STACK.md (technical constraints)
7. _AI_COMPANY/MEMORY/STYLE_GUIDE.md (design system - REQUIRED for HI Designer)
8. _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (pipeline state)
9. _AI_COMPANY/MEMORY/AUDIT_RESULTS.md (issues from last cycle, if any)

Follow the meeting protocol in your role card. After the user approves an option, you MUST write to:
- _AI_COMPANY/MEMORY/DECISIONS.md (append decision)
- _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (overwrite with approved request details)
- _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (update stage to BLUEPRINT)
PROMPT
)"
    ;;
  2)
    echo "${CYAN}Deploying Blueprint Squad...${RESET}"
    claude -p "$(cat <<'PROMPT'
Read the following files in order, then start planning:
1. _AI_COMPANY/ROLES/02_BLUEPRINT_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (approved decision - THIS IS YOUR INPUT)
3. _AI_COMPANY/MEMORY/DECISIONS.md (full decision context)
4. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes - REQUIRED for Conflict Resolution persona test)
5. _AI_COMPANY/MEMORY/STACK.md (technical constraints)
6. _AI_COMPANY/MEMORY/SCHEMA.sql (existing schema)
7. _AI_COMPANY/MEMORY/FILE_MAP.md (existing file structure)
8. _AI_COMPANY/MEMORY/MISSION.md (product context)

Follow the planning protocol in your role card. You MUST write your outputs to:
- _AI_COMPANY/MEMORY/TECHNICAL_SPEC.md (FULL spec - this is the handoff to Execution Squad)
- _AI_COMPANY/MEMORY/SCHEMA.sql (updated schema)
- _AI_COMPANY/MEMORY/real_data_sources.md (API docs and sample responses)
- _AI_COMPANY/MEMORY/FILE_MAP.md (planned new files)
- _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (update stage to EXECUTION)
PROMPT
)"
    ;;
  3)
    echo "${CYAN}Deploying Execution Squad...${RESET}"
    claude -p "$(cat <<'PROMPT'
Read the following files in order, then start building:
1. _AI_COMPANY/ROLES/03_EXECUTION_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/STACK.md (technology stack - READ FIRST)
3. _AI_COMPANY/MEMORY/TECHNICAL_SPEC.md (BUILD INSTRUCTIONS - your primary input)
4. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (original request context)
5. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes - Builder/UI_Designer must honor persona promises)
6. _AI_COMPANY/MEMORY/SCHEMA.sql (data layer)
7. _AI_COMPANY/MEMORY/STYLE_GUIDE.md (existing styles)
8. _AI_COMPANY/MEMORY/FILE_MAP.md (where things go)
9. _AI_COMPANY/MEMORY/real_data_sources.md (data sources and sample API responses)

Follow the build protocol and constraints in your role card. You MUST write your outputs to:
- _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (log ALL files created/modified, testIDs, analytics events)
- _AI_COMPANY/MEMORY/FILE_MAP.md (update with new files)
- _AI_COMPANY/MEMORY/STYLE_GUIDE.md (new styles)
- _AI_COMPANY/MEMORY/STACK.md (if new dependencies added)
- _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (update stage to VERIFICATION)
PROMPT
)"
    ;;
  4)
    echo "${CYAN}Deploying Verification Squad...${RESET}"
    claude -p "$(cat <<'PROMPT'
Read the following files in order, then run the gauntlet:
1. _AI_COMPANY/ROLES/04_VERIFICATION_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (what the user asked for)
3. _AI_COMPANY/MEMORY/TECHNICAL_SPEC.md (what was planned - check acceptance criteria)
4. _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (what was actually built - files, testIDs, events)
5. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes - REQUIRED for Persona Validation)
6. _AI_COMPANY/MEMORY/STACK.md (technical standards)
7. _AI_COMPANY/MEMORY/SCHEMA.sql (data layer to review)
8. _AI_COMPANY/MEMORY/FILE_MAP.md (verify file placement)

Then read the actual code files listed in IMPLEMENTATION_LOG.md and check git diff.

Follow the gauntlet protocol in your role card. You MUST write your outputs to:
- _AI_COMPANY/MEMORY/AUDIT_RESULTS.md (FULL verification report - handoff to Ops Squad)
- _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (update stage to OPS)
PROMPT
)"
    ;;
  5)
    echo "${CYAN}Deploying Ops Squad...${RESET}"
    claude -p "$(cat <<'PROMPT'
Read the following files in order, then fix issues:
1. _AI_COMPANY/ROLES/05_OPS_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/AUDIT_RESULTS.md (what to fix - READ FIRST)
3. _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (what changed in this cycle)
4. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (original request context)
5. _AI_COMPANY/MEMORY/STACK.md (current stack)
6. _AI_COMPANY/MEMORY/FILE_MAP.md (current file map)

Also check: package.json, recent git log.

Follow the ops protocol in your role card. You MUST write your outputs to:
- _AI_COMPANY/MEMORY/STACK.md (update with new libraries)
- _AI_COMPANY/MEMORY/FILE_MAP.md (update with file changes)
- _AI_COMPANY/MEMORY/PIPELINE_STATUS.md (set stage to COMPLETE, archive cycle)
PROMPT
)"
    ;;
  "q!")
    echo "${MAGENTA}Quick Fix Mode${RESET}"
    echo "${DIM}For small/cosmetic changes that don't need the full pipeline.${RESET}"
    echo "${DIM}Examples: change a color, resize a button, tweak copy, fix spacing${RESET}"
    echo ""
    read -p "Describe the quick fix: " QUICK_FIX
    echo ""
    echo "${CYAN}Deploying Quick Fix...${RESET}"
    claude -p "$(cat <<PROMPT
You are in QUICK FIX mode. This is for small, cosmetic, or trivial changes that don't need the full 5-squad pipeline.

Read these files for context:
1. _AI_COMPANY/MEMORY/CURRENT_STATE.md (what the app looks like today)
2. _AI_COMPANY/MEMORY/STYLE_GUIDE.md (design tokens and patterns)
3. _AI_COMPANY/MEMORY/STACK.md (technology stack)
4. _AI_COMPANY/MEMORY/PERSONAS.md (make sure the fix doesn't break persona promises)

CEO's request: "$QUICK_FIX"

QUICK FIX PROTOCOL:
1. Identify the exact file(s) to change (should be 1-3 files max)
2. If this change affects more than 3 files or requires new services/components, STOP and tell the CEO: "This needs the full pipeline. Run option 1 (Strategy Squad) instead."
3. Make the change
4. Briefly verify it doesn't break persona promises (Shark/Debater/Homer)
5. Log what you changed in _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (append, don't overwrite)
6. Update _AI_COMPANY/MEMORY/CURRENT_STATE.md if the change affects what the user sees

Do NOT run the full meeting protocol. Just fix it and report back.
PROMPT
)"
    ;;
  r)
    echo "${YELLOW}Rework Mode${RESET}"
    echo "${DIM}Send the current output back to a previous squad for revision.${RESET}"
    echo ""
    echo "  ${GREEN}1)${RESET} → Strategy   ${DIM}(Re-debate the options — requirements were wrong)${RESET}"
    echo "  ${GREEN}2)${RESET} → Blueprint  ${DIM}(Re-plan — spec is unbuildable or incomplete)${RESET}"
    echo "  ${GREEN}3)${RESET} → Execution  ${DIM}(Re-build — implementation doesn't match spec)${RESET}"
    echo ""
    read -p "Send back to which squad? (1-3): " rework_target
    echo ""
    read -p "What's wrong? (brief description): " rework_reason
    echo ""

    case $rework_target in
      1)
        echo "${CYAN}Reworking → Strategy Squad...${RESET}"
        claude -p "$(cat <<PROMPT
REWORK MODE: The CEO is sending work back to Strategy Squad for re-evaluation.

Reason for rework: "$rework_reason"

Read these files:
1. _AI_COMPANY/ROLES/01_STRATEGY_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (the current approved option that needs rework)
3. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes)
4. _AI_COMPANY/MEMORY/MISSION.md (product context)
5. _AI_COMPANY/MEMORY/CURRENT_STATE.md (what the app looks like today)
6. _AI_COMPANY/MEMORY/STYLE_GUIDE.md (design system)
7. _AI_COMPANY/MEMORY/DECISIONS.md (prior decisions)
8. _AI_COMPANY/MEMORY/AUDIT_RESULTS.md (if verification flagged issues)

REWORK PROTOCOL:
1. CoS reads the rework reason and the current ACTIVE_REQUEST
2. Identify what went wrong with the original option
3. Re-run the meeting protocol with the rework reason as a NEW constraint
4. Present 3 NEW options (don't repeat the failed approach)
5. After CEO approves, overwrite ACTIVE_REQUEST.md (include Persona Scorecard)
6. Set PIPELINE_STATUS.md Current Stage to BLUEPRINT and update the Strategy row to REWORK_COMPLETE
PROMPT
)"
        ;;
      2)
        echo "${CYAN}Reworking → Blueprint Squad...${RESET}"
        claude -p "$(cat <<PROMPT
REWORK MODE: The CEO is sending work back to Blueprint Squad for re-planning.

Reason for rework: "$rework_reason"

Read these files:
1. _AI_COMPANY/ROLES/02_BLUEPRINT_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (the approved option)
3. _AI_COMPANY/MEMORY/TECHNICAL_SPEC.md (the current spec that needs rework)
4. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes)
5. _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (if execution already started, what was built)
6. _AI_COMPANY/MEMORY/STACK.md (technical constraints)
7. _AI_COMPANY/MEMORY/SCHEMA.sql (existing schema)
8. _AI_COMPANY/MEMORY/MISSION.md (product context)

REWORK PROTOCOL:
1. EPM reads the rework reason and the current TECHNICAL_SPEC
2. Identify what's wrong with the current spec
3. Revise the spec, keeping what works and fixing what doesn't
4. Clearly mark what changed: add a "## Rework Changes" section at the top of TECHNICAL_SPEC.md
5. Set PIPELINE_STATUS.md Current Stage to EXECUTION and update the Blueprint row to REWORK_COMPLETE
PROMPT
)"
        ;;
      3)
        echo "${CYAN}Reworking → Execution Squad...${RESET}"
        claude -p "$(cat <<PROMPT
REWORK MODE: The CEO is sending work back to Execution Squad for re-implementation.

Reason for rework: "$rework_reason"

Read these files:
1. _AI_COMPANY/ROLES/03_EXECUTION_SQUAD.md (your role card)
2. _AI_COMPANY/MEMORY/TECHNICAL_SPEC.md (the spec to build against)
3. _AI_COMPANY/MEMORY/ACTIVE_REQUEST.md (original request)
4. _AI_COMPANY/MEMORY/PERSONAS.md (user archetypes)
5. _AI_COMPANY/MEMORY/IMPLEMENTATION_LOG.md (what was already built)
6. _AI_COMPANY/MEMORY/AUDIT_RESULTS.md (if verification flagged issues, fix them)
7. _AI_COMPANY/MEMORY/STYLE_GUIDE.md (design system)
8. _AI_COMPANY/MEMORY/STACK.md (technology stack)

REWORK PROTOCOL:
1. Builder reads the rework reason and the AUDIT_RESULTS/IMPLEMENTATION_LOG
2. Fix the specific issues identified
3. Do NOT rebuild from scratch unless the rework reason requires it
4. Update IMPLEMENTATION_LOG.md with a "## Rework" section describing fixes
5. Set PIPELINE_STATUS.md Current Stage to VERIFICATION and update the Execution row to REWORK_COMPLETE
PROMPT
)"
        ;;
      *)
        echo "${RED}Invalid choice. Please select 1-3.${RESET}"
        ;;
    esac
    ;;
  s)
    echo "${BOLD}Pipeline Status:${RESET}"
    echo ""
    cat "$MEMORY_DIR/PIPELINE_STATUS.md"
    ;;
  q)
    echo "Exiting."
    exit 0
    ;;
  *)
    echo "${RED}Invalid choice. Please select 1-5, q!, r, s, or q.${RESET}"
    ;;
esac
