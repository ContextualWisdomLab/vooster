#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`vspec doctor` reports clean while per-use-case quality gates fail; it does not roll up `verify`".

1. Read goals/63-dogfood-vspec-doctor-reports-clean-while-per-use-case-qual.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: in a project where at least one use case fails its `verify` gates (e.g. POCKET-006 scenario_completeness fail and/or unlinked_steps on POCKET-001..005), `vspec doctor` must NOT return status `ok`. Pin both surfaces in the same scenario so doctor's verdict and the per-use-case `verify` verdicts agree, and assert doctor surfaces an actionable pointer (how many failed / which gate) rather than a clean report.
3. Implement the smallest fix in the stated root-cause area (apps/api/src/application doctor aggregation; docs/07-cli-spec.md doctor semantics): have doctor aggregate per-use-case `verify` results so it reports non-ok with a pointer to the failing keys when any use case fails, and `ok` only when none fail. Doctor must aggregate over the same set of use cases `verify` would check — no single-case shortcut.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
