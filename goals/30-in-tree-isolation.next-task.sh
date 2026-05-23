#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if bash "$ROOT/goals/30-in-tree-isolation.gates.sh" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 30 is green.
  - Run bash scripts/completion-check.sh.
  - Resolve docs/findings/2026-05-23T1748-in-tree-isolation.md.
MSG
else
  cat <<'MSG'
TASK: Make goal 30 green with RED first.
  - Remove shared dist builds from non-meta gate/check scripts.
  - Replace fixed /tmp or .state/*.log paths with per-invocation temp paths.
  - Re-run bash goals/30-in-tree-isolation.gates.sh.
MSG
fi
