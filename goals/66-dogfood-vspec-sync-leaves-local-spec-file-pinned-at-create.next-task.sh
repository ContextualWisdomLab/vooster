#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`vspec sync` leaves the local spec file pinned at the create revision after server-side mutations".

1. Read goals/66-dogfood-vspec-sync-leaves-local-spec-file-pinned-at-create.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: after a server-side mutation, a plain `vspec sync` must leave the on-disk spec file byte-identical to `vspec export markdown <KEY>` — no `export > file` fallback needed. Exercise more than one mutation kind that changes rendered output (at minimum a scenario mutation AND a step mutation) so the fix cannot bring the file current for one kind while leaving another pinned at the stale create revision.
3. Implement the smallest fix in the stated root-cause area (apps/cli/src/commands/sync.ts, apps/cli/src/commands/sync-files.ts, and the API mutation responses' affected_files in apps/api/src/http/*): make `sync` reconcile the local file to the LATEST server revision — either populate affected_files on every rendered-output-changing mutation so the file is rewritten incrementally, or have `sync` re-pull and re-render the current revision before writing.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
