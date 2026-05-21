#!/usr/bin/env bash
# scripts/check-honest-cli-e2e.sh — Goal 6 honest E2E enforcement.
#
# The CLI E2E matrix under apps/cli/tests/e2e-cli/ uses inline fetch() in
# helpers to seed cookies and workspace ids before invoking the CLI. That
# silences gate failures while the user-facing flow stays broken — see
# docs/findings-cli-ux-debt.md.
#
# This script enforces a fetch-free zone for end-to-end scenarios that
# claim to verify the CLI user experience. Every file under
# apps/cli/tests/e2e-cli-honest/ MUST drive only the compiled CLI binary
# (allowed: child_process.spawn, runCli helper). No fetch( calls.
#
# Three checks, in order:
#   1) HONEST_DIR contains ≥ 1 *.test.ts
#   2) No *.ts under HONEST_DIR matches `\bfetch\(`
#   3) vitest run HONEST_DIR exits 0

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HONEST_DIR=apps/cli/tests/e2e-cli-honest

if [ ! -d "$HONEST_DIR" ]; then
  echo "✗ check-honest-cli-e2e: $HONEST_DIR does not exist"
  exit 1
fi

TEST_COUNT=$(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$TEST_COUNT" -eq 0 ]; then
  echo "✗ check-honest-cli-e2e: $HONEST_DIR has no *.test.ts"
  exit 1
fi

OFFENDERS=()
while IFS= read -r f; do
  if grep -qE '\bfetch\(' "$f"; then
    OFFENDERS+=("$f")
  fi
done < <(find "$HONEST_DIR" -name '*.ts' -type f 2>/dev/null)

if [ "${#OFFENDERS[@]}" -gt 0 ]; then
  echo "✗ check-honest-cli-e2e: these honest-flow files call fetch(:"
  printf '    %s\n' "${OFFENDERS[@]}"
  echo "  Honest-flow scenarios must drive the CLI binary only."
  exit 1
fi

if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "✓ check-honest-cli-e2e: shallow checks pass (vitest skipped — VSPEC_GATES_SKIP_DEEP=1)"
  exit 0
fi

LOG=$(mktemp)
if pnpm exec vitest run "$HONEST_DIR" >"$LOG" 2>&1; then
  echo "✓ check-honest-cli-e2e: shallow checks + vitest both pass"
  rm -f "$LOG"
  exit 0
fi

echo "✗ check-honest-cli-e2e: vitest failed against $HONEST_DIR"
tail -40 "$LOG" | sed 's/^/    /'
rm -f "$LOG"
exit 1
