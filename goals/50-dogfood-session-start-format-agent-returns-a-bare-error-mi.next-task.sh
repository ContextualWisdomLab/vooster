#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "session start --format=agent returns a bare 'Error: Missing --pin.' string instead of the agent envelope".

1. Read docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md.
2. Add a failing test that captures the finding's user-visible failure.
3. Implement the smallest fix in the stated root-cause area.
4. Run the targeted test and relevant gate.
5. Update docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md with verification evidence and set resolved: true.
TASK
