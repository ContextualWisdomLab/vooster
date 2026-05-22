#!/usr/bin/env bash
# goals/30-dogfood-roundtrip.next-task.sh — Workflow hints for goal 30.
#
# This file does *workflow channeling* only: it inspects loose state
# signals (file existence, one negative grep) and points at the
# matching Tranche in the goal `.md`. It deliberately does NOT
# prescribe symbol names, exact test titles, URLs, or other
# implementation mechanism — those constrain agent design freedom
# without adding safety. The goal `.md` is the contract; tests are
# the brake.
#
# See `guidelines/goal-iteration.md` § "Designing next-task hints"
# for the (I) state-detection vs (II) mechanism-prescription split.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FOLLOWUPS=docs/findings/2026-05-23T1700-dogfood-followups.md
GOAL_MD=goals/30-dogfood-roundtrip.md

test_exists() {
  # Loose proxy: does any test file matching this glob exist?
  # The agent is free to place the test wherever fits — we just need
  # to know whether the RED step for this Tranche has been started.
  compgen -G "$1" >/dev/null 2>&1
}

if [ ! -f "$FOLLOWUPS" ]; then
  cat <<EOF
TASK: Tranche A — author the deferred-findings tracker.
  Create $FOLLOWUPS first.
  See $GOAL_MD § "Tranche A — Followups Doc".
EOF
  exit 0
fi

if ! test_exists "apps/cli/tests/unit/*project-id*config*.test.ts"; then
  cat <<EOF
TASK: Tranche B3 — RED test for project-id config fall-through.
  Drive resolveContextFlag's project-id arm with a unit test first.
  See $GOAL_MD § "Tranche B" item B3.
EOF
  exit 0
fi

if grep -rE 'requiredFlag\([^)]*,\s*"project-id"\)' apps/cli/src >/dev/null 2>&1; then
  cat <<EOF
TASK: Tranche B3 — sweep remaining project-id call sites.
  Negative invariant: zero callers may still hard-require --project-id.
  Run:  grep -rEln 'requiredFlag\([^)]*,\s*"project-id"\)' apps/cli/src
  See $GOAL_MD § "Tranche B" item B3.
EOF
  exit 0
fi

if ! test_exists "apps/cli/tests/e2e-cli/*init*persist*.test.ts" &&
   ! test_exists "apps/cli/tests/e2e-cli/*init*project-context*.test.ts"; then
  cat <<EOF
TASK: Tranche B4 — RED E2E for init persistence (success + unknown key).
  See $GOAL_MD § "Tranche B" item B4.
EOF
  exit 0
fi

if ! test_exists "apps/api/tests/**/sync-pull-roundtrip*.test.ts" &&
   ! test_exists "apps/api/tests/integration/sync-pull*.test.ts"; then
  cat <<EOF
TASK: Tranche B1 — RED round-trip test for /sync/pull body sections.
  See $GOAL_MD § "Tranche B" item B1.
EOF
  exit 0
fi

if ! test_exists "apps/cli/tests/unit/usecase-show*body*.test.ts" &&
   ! test_exists "apps/cli/tests/unit/usecase-show*human*.test.ts"; then
  cat <<EOF
TASK: Tranche B2 — RED unit test for vspec usecase show body rendering.
  See $GOAL_MD § "Tranche B" item B2.
EOF
  exit 0
fi

if ! test_exists "apps/cli/tests/e2e-cli/*roundtrip*.test.ts" &&
   ! test_exists "apps/cli/tests/e2e-cli/*dogfood*.test.ts"; then
  cat <<EOF
TASK: Tranche B5 — RED end-to-end dogfood round-trip (no --project-id).
  See $GOAL_MD § "Tranche B" item B5.
EOF
  exit 0
fi

cat <<EOF
TASK: Verify Goal 30.
  bash goals/30-dogfood-roundtrip.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
