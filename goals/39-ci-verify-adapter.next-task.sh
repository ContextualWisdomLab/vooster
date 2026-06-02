#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/39-ci-verify-adapter.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 39 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md for T3.
  - Run the next meta-audit before starting T4.
MSG
  exit 0
fi

if [ ! -f action.yml ]; then
  cat <<'MSG'
TASK: Add the GitHub Action adapter.
  - Run pnpm exec vspec verify from action.yml.
  - Preserve exit 0/1 and configure exit 7 handling.
MSG
  exit 0
fi

if [ ! -f .github/workflows/vspec-verify.yml ]; then
  cat <<'MSG'
TASK: Add the copy-paste workflow.
  - Invoke the Action from a pull_request workflow.
  - Surface failures in a PR comment or check detail.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish CI verify adapter.
  - Add vspec init --verify-workflow.
  - Run the Goal 39 gate and completion-check.
MSG
