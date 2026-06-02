#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/35-korean-verb-phrase.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 35 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md for L1.
  - Continue with Goal 36 / L2.
MSG
  exit 0
fi

if ! rg -q "spec_language" apps; then
  cat <<'MSG'
TASK: Add the spec_language selector/default.
  - Default to Korean.
  - Keep existing English verb-phrase behavior working.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish Korean-aware verb phrase validation.
  - Make Korean action titles pass without force.
  - Keep Korean noun titles rejected.
  - Re-run the Goal 35 gate and completion-check.
MSG
