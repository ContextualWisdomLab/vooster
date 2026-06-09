#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`usecase add-stakeholder` duplicate returns a raw `ApiError: API request failed with 409.` with no structured code under --format=agent".

1. Read docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md.
2. Add a failing test that captures the finding's user-visible failure (adding an already-attached stakeholder via `usecase add-stakeholder ... --format=agent` leaks a raw `ApiError: API request failed with 409.` instead of the documented envelope).
3. Implement the smallest fix in the stated root-cause area: map the 409 conflict to the agent envelope with a stable code (e.g. STAKEHOLDER_ALREADY_ATTACHED), a human message, and suggested_next_actions; ensure no raw `ApiError: ... 409` string reaches the agent under --format=agent.
4. Run the targeted test and relevant gate.
5. Update docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md with verification evidence and set resolved: true.
TASK
