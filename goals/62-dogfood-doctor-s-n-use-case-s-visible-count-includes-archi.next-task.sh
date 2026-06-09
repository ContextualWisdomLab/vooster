#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "Doctor's \"N use case(s) visible\" count includes archived specs that `usecase list` hides".

1. Read goals/62-dogfood-doctor-s-n-use-case-s-visible-count-includes-archi.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: with an archived use case present (e.g. POCKET-006 archived, POCKET-001..005 active), `vspec doctor`'s "N use case(s) visible" count must NOT disagree with the default `vspec usecase list` scope. Pin both the doctor count and the list result in the same scenario so the 6-vs-5 drift is the assertion.
3. Implement the smallest fix in the stated root-cause area (apps/api/src/http doctor route count, apps/cli usecase list scope): either count only non-archived use cases so doctor and `list` agree, or relabel the doctor output to make the archived split explicit (e.g. "5 active, 1 archived"). The number the agent reads must match the scope of the command that lists them.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
