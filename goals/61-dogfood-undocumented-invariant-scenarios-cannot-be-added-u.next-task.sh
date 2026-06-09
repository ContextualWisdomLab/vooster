#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "Undocumented invariant: scenarios cannot be added until the use case has >=1 stakeholder interest, surfaced only as a late SCHEMA_INVALID".

1. Read goals/61-dogfood-undocumented-invariant-scenarios-cannot-be-added-u.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: adding a scenario to a use case that has zero stakeholder interests must return the SCHEMA_INVALID "needs at least one stakeholder interest" error WITH suggested_next_actions pointing at `usecase add-stakeholder` (not a bare error that the agent has to guess about).
3. Implement the smallest fix in the stated root-cause area (apps/api/src/http/scenario-routes.ts, apps/api/src/http/scenario-support.ts): attach suggested_next_actions to that SCHEMA_INVALID error so it teaches the remedy. Also surface the ordering (stakeholder interest before scenarios) in apps/api/src/application/ai-guide.ts so the prerequisite is discoverable before it is hit.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
