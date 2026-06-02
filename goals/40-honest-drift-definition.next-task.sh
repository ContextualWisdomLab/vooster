#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/40-honest-drift-definition.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 40 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md for T4.
  - Mark the cycle complete if no in-scope targets remain.
MSG
  exit 0
fi

if rg -q 'spec과 코드의 일치를 CI에서 자동 검증' apps/www/src/components/sections/HowItWorks.astro; then
  cat <<'MSG'
TASK: Rewrite landing drift copy.
  - Define drift as broken implementation link, failing linked test, or unlinked step.
  - Avoid implying semantic code/spec agreement.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish honest drift definition.
  - Document deterministic drift scope in docs/07-cli-spec.md.
  - Run the Goal 40 gate and completion-check.
MSG
