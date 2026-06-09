#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`usecase verify` produces no usable output, so the agent abandons it and verifies via `usecase show`".

1. Read docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-verify-produces-no-usable-output-so.md and goals/54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag.md.
2. Add failing tests that capture the gap: `usecase verify <id> --format=agent` must report a structured structural-completeness check for EACH of the four use-case dimensions (primary actor, level, stakeholders, extensions). A use case missing all four must emit a `missing` check entry for each — implementing only one dimension must leave a test red.
3. Implement the smallest fix in the stated root-cause area (apps/cli/src/commands verify + apps/api/src/application): fold structural gaps into the shared status/exit_code rollup, carry the per-dimension checks inside the --format=agent envelope data, and keep the default human output a clear non-interactive verdict.
4. Document the structural-checks shape under the Verify section of docs/07-cli-spec.md.
5. Run the targeted tests and the goal gate (bash goals/54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag.gates.sh).
6. Update the finding with the verification evidence (the test name / command whose output is now actionable) and set resolved: true.
TASK
