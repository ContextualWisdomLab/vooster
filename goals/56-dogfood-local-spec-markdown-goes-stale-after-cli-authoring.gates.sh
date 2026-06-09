#!/usr/bin/env bash
# goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh
# A successful CLI authoring mutation must never leave the local spec silently
# stale: materialize affected_files when possible, else emit a `vspec pull`
# next-action -- guaranteed for every verb by a single shared mutation runner.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/application/mutation-command.ts
  apps/cli/src/application/mutation-runner.ts
  apps/cli/src/application/auto-export.ts
  apps/cli/tests/unit/mutation-stale-local-files.test.ts
  docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-002-local-spec-markdown-goes-stale-after-cli-au.md
  goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.md
  goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[56.A1] CLI typecheck (materialize-or-pull-hint wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[56.A2] materialize / pull-hint behavior suite passes (existing mutation suites stay green)"
if pnpm exec vitest run apps/cli/tests/unit/mutation-stale-local-files.test.ts --passWithNoTests=false; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[56.B1] exactly one runMutation( call site, in the shared mutation-command runner"
# Universal guarantee: the materialize-or-pull-hint logic must govern EVERY
# authoring verb, not just the one the behavior test exercises. A test proves
# the guarantee for the path it runs; it cannot prove a second, guarantee-free
# mutation path was not introduced elsewhere. Enumerate the runMutation() call
# sites from source (grep) and loop -- there must be exactly one, and it must be
# the shared runner in mutation-command.ts. (while-read, not mapfile -- system
# bash is 3.2 and lacks readarray.)
CALL_SITES=$(grep -rn 'runMutation(' apps/cli/src | grep -v 'function runMutation' || true)
CALL_COUNT=$(printf '%s\n' "$CALL_SITES" | grep -c .)

if [ "$CALL_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 runMutation( call site, found $CALL_COUNT:"
  printf '%s\n' "$CALL_SITES" | sed 's/^/      /'
  PASS=false
else
  while IFS= read -r site; do
    [ -z "$site" ] && continue
    case "$site" in
      apps/cli/src/application/mutation-command.ts:*)
        echo "    ok: single funnel -> $site"
        ;;
      *)
        echo "    fail -- runMutation( called outside the shared runner: $site"
        PASS=false
        ;;
    esac
  done < <(printf '%s\n' "$CALL_SITES")
fi

echo "[56.C1 Gate rigor]"
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
