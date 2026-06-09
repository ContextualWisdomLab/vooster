#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 43 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 usecase-verify finding.
MSG
  exit 0
fi

if ! grep -q 'runVerify' apps/cli/src/commands/usecase.ts; then
  cat <<'MSG'
TASK: Route the `verify` use-case action into the existing runVerify producer.
  - `vspec usecase verify <id>` currently dead-ends: runUsecase in
    apps/cli/src/commands/usecase.ts has no `verify` action, so it falls through
    to `throw new Error("Missing usecase action.")` and prints only a banner.
  - The verdict logic already exists -- runVerify in
    apps/cli/src/commands/verify.ts emits status / drift across human, json, and
    agent formats. Do NOT write a second verdict path.
  - Write a failing unit test first
    (apps/cli/tests/unit/usecase-verify-routing.test.ts): calling
    runUsecase(flags, "verify", "<id>", writeLine) must produce a verdict (not
    throw "Missing usecase action."), and for EACH format (human / json / agent)
    the output must carry a branchable status -- a human verdict line naming the
    key + status, a json `status`, and an agent envelope `data.status`. Exit code
    follows the verdict (0 pass / 7 unlinked / 1 otherwise).
  - Then route the `verify` action in runUsecase into the shared runVerify,
    passing through the relevant flags (api-url, format, root, session-cookie).
  - Re-run the Goal 43 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish per-format verdict + single-source, then verify.
  - The verify action is wired, but the gate is still red. Confirm:
      * every format (human / json / agent) emits a branchable verdict with a
        status field -- none prints only a banner
        (apps/cli/tests/unit/usecase-verify-routing.test.ts),
      * the existing `vspec verify` verdict suite stays green
        (apps/cli/tests/unit/verify-command.test.ts),
      * there is exactly ONE runVerify definition under apps/cli/src and every
        other referrer imports it -- no copied verdict path that can drift.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/verify-command.test.ts
      bash goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
MSG
