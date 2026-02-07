---
description: Show pipeline status and recommend next command
---

# PuckIQ Pipeline Status

Show the current pipeline status and recommend the next action.

## Instructions

1. Read `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md`
2. Read `_AI_COMPANY/MEMORY/ACTIVE_REQUEST.md`

3. Display a status report:

```
PUCKIQ PIPELINE STATUS
======================
Stage: [current stage from PIPELINE_STATUS.md]
Active Request: [summary from ACTIVE_REQUEST.md, or "None" if idle]
```

4. If there is pipeline history, show the pipeline progress table from PIPELINE_STATUS.md.

5. Based on the current stage, recommend the next command:

| Stage | Next Command | Description |
|-------|-------------|-------------|
| IDLE | `/strategy [request]` | Start a new request with the Strategy Squad |
| COMPLETE | `/strategy [request]` | Previous cycle done — start a new request |
| BLUEPRINT | `/blueprint` | Strategy approved — create the technical + design spec |
| EXECUTION | `/build` | Spec complete — implement with phased checkpoints |
| VERIFICATION | `/verify` | Code written — run the full gauntlet (test, security, QA, UX, legal) |
| OPS | `/ops` | Audit complete — fix issues (including UI/UX) and close the cycle |

6. Always list all available pipeline commands at the end:

```
AVAILABLE COMMANDS
==================
/strategy [request]  - Start: debate options with Screen-by-Screen Impact (Greenlight Meeting)
/blueprint           - Plan: create technical + design spec with Screen Design Specs
/build               - Code: implement with phased checkpoints and screenshot verification
/verify              - Audit: test, security, QA, UI/UX, legal, persona, strategic alignment
/ops                 - Close: fix issues (including UI/UX deviations), update docs, archive
/quick-fix [desc]    - Skip pipeline for small 1-3 file changes (with screenshot verify)
/rework [#] [reason] - Send work back to squad 1, 2, or 3
/pipeline            - Show this status
```

7. If the stage is unexpected or the file is missing/malformed, say the pipeline is in an unknown state and suggest running `/strategy` to start fresh or checking `_AI_COMPANY/MEMORY/PIPELINE_STATUS.md` manually.
