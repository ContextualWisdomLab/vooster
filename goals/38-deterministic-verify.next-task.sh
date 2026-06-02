#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/38-deterministic-verify.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 38 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md for T2.
  - Continue with T3 CI gate adapter.
MSG
  exit 0
fi

if [ ! -f apps/cli/src/commands/verify.ts ]; then
  cat <<'MSG'
TASK: Add the verify command.
  - Read usecase show data and check step.implements refs against the local root.
  - Route it from apps/cli/src/index.ts.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish deterministic verify.
  - Exit 1 for broken links or delegated test failure.
  - Exit 7 for unlinked steps when links are otherwise valid.
  - Prove 10 repeated JSON runs are identical.
MSG
