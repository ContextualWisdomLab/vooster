#!/usr/bin/env bash
# goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.gates.sh
# Every spec-mutating CLI verb must leave the local working copy reconciled with
# the server: materialize the affected specs/<KEY>.md when auto-export can run,
# else emit a `vspec pull` stale-warning -- guaranteed for every verb by a single
# shared materialization funnel (one autoExport( call site).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="69-dogfood-local-working-copy-goes-stale-after-server-side-mu"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/application/mutation-runner.ts
  apps/cli/src/application/mutation-command.ts
  apps/cli/src/application/auto-export.ts
  apps/cli/tests/unit/working-copy-reconcile.test.ts
  docs/findings/2026-06-04T2303-dogfood-20260604T224051Z-df-002-local-working-copy-goes-stale-after-server-.md
  goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.md
  goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[69.A1] CLI typecheck (materialize-or-warn wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[69.A2] working-copy reconciliation suite passes (existing mutation suites stay green)"
if pnpm exec vitest run apps/cli/tests/unit/working-copy-reconcile.test.ts --passWithNoTests=false; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[69.B1] exactly one autoExport( materialization funnel, in the shared mutation runner"
# Universal invariant: local materialization must run through EXACTLY ONE funnel
# so the materialize-or-warn guarantee applies to every spec-mutating verb, not
# just the verbs the behavior suite drives. A behavior test proves the guarantee
# only for the path it exercises; it cannot prove a second, guarantee-free
# materialization path was not introduced elsewhere. Enumerate the autoExport()
# call sites from source (grep) and loop -- there must be exactly one, and it
# must be the shared runner in mutation-runner.ts. (while-read, not mapfile --
# system bash is 3.2 and lacks readarray.)
CALL_SITES=$(grep -rn 'autoExport(' apps/cli/src | grep -v 'function autoExport' || true)
CALL_COUNT=$(printf '%s\n' "$CALL_SITES" | grep -c .)

if [ "$CALL_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 autoExport( call site, found $CALL_COUNT:"
  printf '%s\n' "$CALL_SITES" | sed 's/^/      /'
  PASS=false
else
  while IFS= read -r site; do
    [ -z "$site" ] && continue
    case "$site" in
      apps/cli/src/application/mutation-runner.ts:*)
        echo "    ok: single funnel -> $site"
        ;;
      *)
        echo "    fail -- autoExport( called outside the shared runner: $site"
        PASS=false
        ;;
    esac
  done < <(printf '%s\n' "$CALL_SITES")
fi

echo "[69.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
