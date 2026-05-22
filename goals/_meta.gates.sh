#!/usr/bin/env bash
# goals/_meta.gates.sh — Cross-cutting gate suite.
#
# Captures invariants that span the whole repo rather than a single goal:
#   M.1 — tsc --noEmit clean
#   M.2 — eslint . --max-warnings 0 clean
#   M.3 — vitest run --coverage passes (tests green + coverage thresholds)
#   M.4 — every app under apps/* with a build script builds
#
# These claims used to be duplicated across goals 0/1/2/3/4/5/8 and the
# CI workflow. Centralizing here:
#   - eliminates duplicate execution in pre-commit and CI
#   - lets each goal-local gate focus on its own universal claims
#   - shrinks per-goal GATE_INPUTS, raising cache hit rate
#
# Env:
#   VSPEC_GATES_SKIP_DEEP=1   skip M.3 + M.4 (vitest + builds) for fast iter
#   VSPEC_GATES_NO_CACHE=1    bypass content-fingerprint cache

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  GOAL_NAME="_meta-shallow"
  CACHE_LABEL="meta shallow"
else
  GOAL_NAME="_meta"
  CACHE_LABEL="meta"
fi

# Inputs that determine this meta gate's result. Broad by design — these
# checks are cross-cutting. Cache invalidates whenever any code, config,
# or test changes.
GATE_INPUTS=(
  apps/api/src
  apps/api/tests
  apps/api/prisma
  apps/api/package.json
  apps/api/tsconfig.json
  apps/cli/src
  apps/cli/tests
  apps/cli/bin
  apps/cli/package.json
  apps/cli/tsconfig.json
  apps/web
  apps/www
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.json
  tsconfig.eslint.json
  vitest.config.ts
  eslint.config.js
  goals/_meta.gates.sh
  goals/_meta.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] $CACHE_LABEL inputs unchanged"
  exit 0
fi

PASS=true
LOG_DIR=$(mktemp -d)
TSC_LOG="$LOG_DIR/tsc.log"
ESLINT_LOG="$LOG_DIR/eslint.log"
VITEST_LOG="$LOG_DIR/vitest.log"

# ─── M.1 TypeScript clean ───────────────────────────────────────────────
echo "[M.1] tsc --noEmit (every TypeScript file compiles)"
if pnpm exec tsc --noEmit >"$TSC_LOG" 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — see $TSC_LOG"
  PASS=false
fi

# ─── M.2 ESLint clean ───────────────────────────────────────────────────
echo "[M.2] eslint . --max-warnings 0 (every TS/TSX file lint-clean)"
if pnpm exec eslint . --max-warnings 0 >"$ESLINT_LOG" 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — see $ESLINT_LOG"
  PASS=false
fi

# ─── M.3 vitest + coverage ──────────────────────────────────────────────
echo "[M.3] vitest run --coverage (every test passes, coverage thresholds met)"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
else
  COVERAGE_DIR=$(mktemp -d)
  if VSPEC_COVERAGE_DIR="$COVERAGE_DIR" pnpm exec vitest run --coverage >"$VITEST_LOG" 2>&1; then
    echo "    ✓ pass"
    rm -rf "$COVERAGE_DIR"
  else
    echo "    ✗ fail — see $VITEST_LOG"
    rm -rf "$COVERAGE_DIR"
    PASS=false
  fi
fi

# ─── M.4 every workspace app builds ─────────────────────────────────────
echo "[M.4] every apps/* with a build script builds"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
else
  BUILD_FAIL=()
  BUILD_COUNT=0
  while IFS= read -r pkg; do
    app_dir=$(dirname "$pkg")
    app_name=$(basename "$app_dir")
    has_build=$(node -e "
      try { const p = require('./${pkg}'); process.stdout.write((p.scripts && p.scripts.build) ? 'y' : 'n'); }
      catch (e) { process.exit(1); }
    " 2>/dev/null || echo n)
    [ "$has_build" = "y" ] || continue
    BUILD_COUNT=$((BUILD_COUNT + 1))
    build_log="$LOG_DIR/build-${app_name}.log"
    if ! pnpm --filter "@vooster/${app_name}" build >"$build_log" 2>&1; then
      BUILD_FAIL+=("${app_name} (see $build_log)")
    fi
  done < <(find apps -maxdepth 2 -name package.json -type f | sort)
  if [ "${#BUILD_FAIL[@]}" -eq 0 ]; then
    echo "    ✓ pass (${BUILD_COUNT} apps built)"
  else
    echo "    ✗ fail —"
    printf '        %s\n' "${BUILD_FAIL[@]}"
    PASS=false
  fi
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  if [ "$GOAL_NAME" = "_meta" ]; then
    gate_cache_save "_meta-shallow" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
