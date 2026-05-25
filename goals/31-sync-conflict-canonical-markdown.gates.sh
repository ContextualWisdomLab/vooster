#!/usr/bin/env bash
# goals/31-sync-conflict-canonical-markdown.gates.sh — sync conflict markdown invariant.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=true
MARKDOWN_HITS="$(mktemp -t vspec-goal31-usecase-markdown.XXXXXX)"
trap 'rm -f "$MARKDOWN_HITS"' EXIT

echo "[31.A1] sync source no longer calls usecaseMarkdown"
if grep -rEn 'usecaseMarkdown[[:space:]]*\(' apps/api/src >"$MARKDOWN_HITS"; then
  echo "    ✗ fail — stripped sync markdown helper is still referenced:"
  sed 's/^/        /' "$MARKDOWN_HITS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[31.B1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/31-sync-conflict-canonical-markdown.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/31-sync-conflict-canonical-markdown.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
