#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`verify` flags `unlinked_steps` / demands `implements` refs in a code-less, DRAFT spec repo (false positive)".

1. Read goals/65-dogfood-verify-flags-unlinked-steps-demands-implements-ref.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: in a code-less project whose use case is at DRAFT, `vspec verify <KEY>` must NOT report `unlinked_steps` for its steps and must NOT suggest adding `implements` refs. Cover more than one key so the fix cannot special-case a single use case while leaving the false positive live on the others. Also pin the inverse so the check is not simply deleted: once the project has an implementation/test surface OR the use case advances past DRAFT, `unlinked_steps` still fires for genuinely unlinked steps.
3. Implement the smallest fix in the stated root-cause area (apps/api/src/application verify step-linking heuristic; apps/cli/src/commands/verify): gate `unlinked_steps` on whether the project has any implementation/test surface OR the use case is past DRAFT, so a code-less DRAFT spec is never pressured into fabricating `implements` refs. The real spec gates (actors_registered, scenario_completeness, extension_points_resolved, cockburn_fidelity) must continue to fire unchanged.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
