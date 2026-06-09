#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "No way to list or read-only inspect archived use cases; agent guessed nonexistent flags and mutated state to investigate".

1. Read goals/64-dogfood-no-way-to-list-or-read-only-inspect-archived-use-c.md (the finding is recorded inline under "Source finding"; the recommendation has three clauses).
2. Add failing tests that capture the finding's user-visible failures:
   - `vspec usecase list` with an archived-inclusive flag (e.g. --archived / --all) surfaces an archived use case that the default scope hides, and marks it as archived.
   - `vspec usecase show <KEY>` renders an archived use case read-only, with its archived state explicit and NO state mutation (no restore/re-archive).
   - an unknown flag on a `usecase` subcommand yields a single accurate error naming the bad flag, with no spurious "Command ... not found." second line.
3. Implement the smallest fix in the stated root-cause area (apps/cli/src/commands usecase list/show + apps/api/src/http read path). Inspecting an archived spec must never require a `restore` round-trip.
4. Run the targeted tests and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
