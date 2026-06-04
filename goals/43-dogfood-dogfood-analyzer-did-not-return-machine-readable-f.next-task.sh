#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "Dogfood analyzer did not return machine-readable findings".

1. Read docs/findings/2026-06-02T2151-dogfood-dogfood-analyzer-did-not-return-machine-readable-f.md.
2. Add a failing test that captures the finding's user-visible failure.
3. Implement the smallest fix in the stated root-cause area.
4. Run the targeted test and relevant gate.
5. Update docs/findings/2026-06-02T2151-dogfood-dogfood-analyzer-did-not-return-machine-readable-f.md with verification evidence and set resolved: true.
TASK
