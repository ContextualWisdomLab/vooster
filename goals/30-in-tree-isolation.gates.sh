#!/usr/bin/env bash
# goals/30-in-tree-isolation.gates.sh — negative invariants for parallel gate workers.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=true
BUILD_PATTERN='^[[:space:]]*(if[[:space:]]+!?[[:space:]]*)?(pnpm (run )?(--silent )?build|pnpm --filter .+ build|pnpm exec tsc( |$))'
TEMP_PATTERN='/tmp/[A-Za-z0-9._-]+|\.state/[A-Za-z0-9._-]+\.log'

target_files() {
  if [ -n "${VSPEC_GOAL30_TARGET_FILES:-}" ]; then
    printf '%s\n' "$VSPEC_GOAL30_TARGET_FILES"
    return
  fi
  find goals -maxdepth 1 -name '*.gates.sh' -type f | sort
  find scripts -maxdepth 1 \( -name 'check-*.sh' -o -name 'dogfood-test.sh' \) -type f | sort
}

echo "[30.A1] non-meta gate/check scripts do not build shared dist/"
BUILD_VIOLATIONS=()
while IFS= read -r file; do
  [ "$file" = "goals/_meta.gates.sh" ] && continue
  while IFS= read -r hit; do
    BUILD_VIOLATIONS+=("$file:$hit")
  done < <(grep -nE "$BUILD_PATTERN" "$file" 2>/dev/null || true)
done < <(target_files)
if [ "${#BUILD_VIOLATIONS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — shared build invocations outside goals/_meta.gates.sh:"
  printf '        %s\n' "${BUILD_VIOLATIONS[@]}"
  PASS=false
fi

echo "[30.A2] gate/check scripts do not write fixed temp paths"
TEMP_VIOLATIONS=()
while IFS= read -r file; do
  while IFS= read -r hit; do
    TEMP_VIOLATIONS+=("$file:$hit")
  done < <(grep -nE "$TEMP_PATTERN" "$file" 2>/dev/null || true)
done < <(target_files)
if [ "${#TEMP_VIOLATIONS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — use mktemp or a per-invocation filename:"
  printf '        %s\n' "${TEMP_VIOLATIONS[@]}"
  PASS=false
fi

echo "[30.B1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/30-in-tree-isolation.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/30-in-tree-isolation.md" | sed 's/^/      /'
  PASS=false
fi

echo "[30.B2 Pattern self-test]"
if [ "${VSPEC_GOAL30_SKIP_SELF_TEST:-0}" = "1" ]; then
  echo "    ⊘ skipped"
else
  SELF_TEST_DIR=$(mktemp -d)
  tmp_prefix="/tmp"
  pass_fixture="$SELF_TEST_DIR/pass.sh"
  fail_fixture="$SELF_TEST_DIR/fail.sh"
  printf '%s\n' "# was ${tmp_prefix}/foo" >"$pass_fixture"
  printf '%s\n' "bash -c 'cp ${tmp_prefix}/literal /dest'" >"$fail_fixture"
  if VSPEC_GOAL30_SKIP_SELF_TEST=1 VSPEC_GOAL30_TARGET_FILES="$pass_fixture" bash "$0" >/dev/null 2>&1 &&
    ! VSPEC_GOAL30_SKIP_SELF_TEST=1 VSPEC_GOAL30_TARGET_FILES="$fail_fixture" bash "$0" >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail"
    PASS=false
  fi
  rm -rf "$SELF_TEST_DIR"
fi

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
