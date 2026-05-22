#!/usr/bin/env bash
# goals/_meta.next-task.sh — invoked when _meta is the active failing goal.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cat <<'EOF'
# Goal _meta: cross-cutting invariants failed

A cross-cutting check (lint / typecheck / test+coverage / build) is red.
Re-run the meta suite to see which gate failed:

    bash goals/_meta.gates.sh

Common fixes:

  M.1  tsc --noEmit errors
       → fix types, or update tsconfig.json
       → log: /tmp/_meta-tsc.log

  M.2  ESLint errors / warnings
       → fix code, or update eslint.config.js
       → log: /tmp/_meta-eslint.log

  M.3  vitest red, or coverage below threshold
       → fix failing test, or add tests under apps/api/src/
       → log: /tmp/_meta-vitest.log

  M.4  app build failed
       → pnpm --filter @vooster/<app> build
       → log: /tmp/_meta-build-<app>.log

Once _meta passes, completion-check resumes the numeric goal sweep.
EOF
