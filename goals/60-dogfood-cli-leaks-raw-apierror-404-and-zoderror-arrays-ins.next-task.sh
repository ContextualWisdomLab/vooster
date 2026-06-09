#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "CLI leaks raw `ApiError: 404` and `ZodError` arrays instead of the documented envelope".

1. Read goals/60-dogfood-cli-leaks-raw-apierror-404-and-zoderror-arrays-ins.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: under `--format=agent`, an invalid `usecase set --field/--value` and an incomplete `change propose` patch must NOT leak a raw `ZodError: [ ... ]` array, and a missing target must NOT leak a bare `ApiError: API request failed with 404.`.
3. Implement the smallest fix in the stated root-cause area (apps/cli/src envelope/error boundary, apps/api/src/http/scenario-support.ts, apps/api/src/http/step-routes.ts): catch zod validation and HTTP 404 at the boundary and map them to the documented agent envelope with a stable machine `code`, a human `message`, and `suggested_next_actions`. The bad `--field`/`--value` path should teach valid options the way `actor create --type BOGUS` already does.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (a "## Verification" section) and set `resolved: true` in its frontmatter.
TASK
