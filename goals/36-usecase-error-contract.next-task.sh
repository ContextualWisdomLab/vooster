#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/36-usecase-error-contract.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 36 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md for L2.
  - Continue with L4 analyze-session skill port.
MSG
  exit 0
fi

if rg -q "Use case title should be a verb phrase|Primary actor is not available" \
  apps/cli/src/domain/error-codes.ts; then
  cat <<'MSG'
TASK: Remove problem-title classification from CLI error-codes.
  - Prefer a typed API body.code.
  - Keep HTTP status fallback for uncoded problems.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish typed self-teaching usecase errors.
  - Return code, field, and allowed_values for invalid usecase payloads.
  - Keep usecase authoring domain failures coded.
  - Re-run the Goal 36 gate and completion-check.
MSG
