#!/usr/bin/env bash
# goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.gates.sh
# A pure-CLI authoring flow must never self-conflict on its first `vspec push`:
# every authoring write must leave the local spec cache's base_revision equal to
# the server head it produced, so push fast-forwards. Guaranteed for every
# command by two single-source invariants -- one materialization funnel
# (autoExport in mutation-runner.ts) and one push-base reader (baseRevisionFrom
# in sync-files.ts) -- plus a CLI behaviour suite that locks the no-conflict flow.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/application/mutation-runner.ts
  apps/cli/src/application/auto-export.ts
  apps/cli/src/commands/sync-files.ts
  apps/cli/tests/unit/push-after-cli-authoring.test.ts
  packages/contracts/src/sync.ts
  docs/findings/2026-06-04T2359-dogfood-20260604T234100Z-df-001-first-push-self-conflicts-on-local-markdown.md
  goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.md
  goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[73.A1] CLI typecheck (push-base / materialization wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[73.A2] push-after-cli-authoring behaviour suite passes (no self-conflict; existing sync suites stay green)"
if pnpm exec vitest run apps/cli/tests/unit/push-after-cli-authoring.test.ts --passWithNoTests=false; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

# B1 / B2 are universal structural invariants: the no-self-conflict guarantee
# must apply to EVERY authoring write command, not just the verbs the behaviour
# suite drives. A behaviour test proves the flow only for the path it exercises;
# it cannot prove a second materialization path or a second push-base reader was
# not introduced elsewhere. So each call-site set is enumerated from source and
# looped over -- there must be exactly one, in its stated module. (while-read,
# not mapfile -- system bash is 3.2 and lacks readarray.)

assert_single_funnel() {
  local label="$1" pattern="$2" exclude="$3" expected_module="$4"
  local sites count ok=true
  sites=$(grep -rn "$pattern" apps/cli/src | grep -v "$exclude" || true)
  count=$(printf '%s\n' "$sites" | grep -c .)

  if [ "$count" -ne 1 ]; then
    echo "    fail -- expected exactly 1 $label call site, found $count:"
    printf '%s\n' "$sites" | sed 's/^/      /'
    return 1
  fi

  while IFS= read -r site; do
    [ -z "$site" ] && continue
    case "$site" in
      "$expected_module":*)
        echo "    ok: single $label funnel -> $site"
        ;;
      *)
        echo "    fail -- $label called outside $expected_module: $site"
        ok=false
        ;;
    esac
  done < <(printf '%s\n' "$sites")

  [ "$ok" = true ]
}

echo "[73.B1] exactly one materialization funnel (autoExport( in the shared mutation runner)"
if assert_single_funnel \
  "autoExport(" "autoExport(" "function autoExport" \
  "apps/cli/src/application/mutation-runner.ts"; then
  :
else
  PASS=false
fi

echo "[73.B2] exactly one push-base reader (baseRevisionFrom( in sync-files.ts)"
if assert_single_funnel \
  "baseRevisionFrom(" "baseRevisionFrom(" "function baseRevisionFrom" \
  "apps/cli/src/commands/sync-files.ts"; then
  :
else
  PASS=false
fi

echo "[73.C1 Gate rigor]"
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
