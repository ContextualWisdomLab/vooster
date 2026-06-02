#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/37-step-implements-traceability.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 37 is green.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md for T1.
  - Run the next meta-audit before starting T2.
MSG
  exit 0
fi

if ! rg -q 'implements\s+String\[\]\s+@default\(\[\]\)' apps/api/prisma/schema.prisma; then
  cat <<'MSG'
TASK: Add persisted Step.implements.
  - Add the Prisma field with default [].
  - Carry it through StoredStep and persistence mappers.
MSG
  exit 0
fi

if ! rg -q 'steps\.unlinked' apps/api/src/application/doctor.ts; then
  cat <<'MSG'
TASK: Add doctor warning for unlinked scenario steps.
  - Emit steps.unlinked when persisted scenario steps have no implementation refs.
  - Cover it with a focused doctor unit test.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish step implementation traceability.
  - Validate implements refs through contracts and CLI.
  - Round-trip markdown implements annotations.
  - Re-run the Goal 37 gate and completion-check.
MSG
