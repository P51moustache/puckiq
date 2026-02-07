---
description: Spawn the PuckIQ 9-agent development team
---

# Spawn PuckIQ Agent Team

Read the team manifest and all agent definition files, then create and spawn the full team.

## Instructions

1. Read `.claude/agents/team-manifest.md` for the team overview.

2. Create the team:
   - TeamCreate with team_name: "puckiq-dev", description: "PuckIQ React Native/Expo app development team"

3. Spawn ALL 9 agents in parallel using the Task tool. For each agent:
   - Read the agent's definition file from `.claude/agents/{role}.md`
   - Use the file contents as the agent's prompt
   - Set the parameters per this table:

| name | model | file |
|------|-------|------|
| ceo-orchestrator | opus | .claude/agents/ceo-orchestrator.md |
| product-manager | opus | .claude/agents/product-manager.md |
| ux-designer | sonnet | .claude/agents/ux-designer.md |
| frontend-engineer | sonnet | .claude/agents/frontend-engineer.md |
| backend-engineer | sonnet | .claude/agents/backend-engineer.md |
| devops-engineer | sonnet | .claude/agents/devops-engineer.md |
| qa-tester | sonnet | .claude/agents/qa-tester.md |
| security-reviewer | opus | .claude/agents/security-reviewer.md |
| performance-optimizer | sonnet | .claude/agents/performance-optimizer.md |

   For ALL agents use:
   - subagent_type: "general-purpose"
   - team_name: "puckiq-dev"
   - mode: "bypassPermissions"
   - run_in_background: true

4. After all agents are spawned, confirm the team is ready and list all agents with their roles.

5. Optionally, also spawn the strategy-partner agent (Opus) if the user wants a brainstorming companion. Ask first.
