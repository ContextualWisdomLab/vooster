#!/usr/bin/env bash
# goals/3-managed-db.gates.sh — Gate suite for goal 3 (managed Postgres).
#
# Anti-cheat principle: every gate enumerates from a source of truth
# (the filesystem, apps/api/prisma/schema.prisma, .github/workflows/). If the goal
# text says "every X," the gate iterates X.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="3-managed-db"

# Inputs that determine this goal's gate result.
# Gates exercised: Postgres helper sweep, schema provider check, sqlite
# literal scan, Dockerfile migration check, check-managed-db.sh,
# .github/workflows/ CI inspection, check-ci.sh, gate-rigor on goal 3 md.
# vitest execution moved to goals/_meta.gates.sh (M.3).
GATE_INPUTS=(
  apps/api/src
  apps/api/tests
  apps/api/prisma/schema.prisma
  apps/cli/tests/e2e-cli/helpers.ts
  Dockerfile
  docker-compose.yml
  docker-compose.prod.yml
  .env.example
  .github/workflows
  package.json
  pnpm-lock.yaml
  scripts/check-managed-db.sh
  scripts/check-ci.sh
  scripts/check-gate-rigor.sh
  goals/3-managed-db.gates.sh
  goals/3-managed-db.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

run_gate() {
  local label="$1"
  local cmd="$2"
  echo "[$label]"
  if bash -c "$cmd" >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — re-run: $cmd"
    PASS=false
  fi
}

# Directories the "no sqlite literal" scan covers. Each is iterated.
SQLITE_FORBIDDEN_DIRS=(apps/api/prisma apps/api/src scripts apps/api/tests apps/cli/src apps/cli/tests)
SQLITE_FORBIDDEN_FILES=(.env.example package.json docker-compose.yml docker-compose.prod.yml Dockerfile)

# ─── Tranche A — Test infrastructure rides Postgres ──────────────────────

echo "[3.A1] Single Postgres test helper exists"
HELPER=apps/api/tests/helpers/postgres-db.ts
if [ ! -f "$HELPER" ]; then
  echo "    ✗ fail — $HELPER missing"
  PASS=false
else
  # The helper must:
  #   - emit a postgresql:// URL
  #   - allocate a unique schema (uuid/cuid/randomUUID/Date.now()+pid/etc.)
  #   - run `prisma db push --skip-generate`
  MISSING=()
  if ! grep -qE 'postgresql://' "$HELPER"; then MISSING+=("postgresql://"); fi
  if ! grep -qE 'randomUUID|crypto\.|uuid|cuid|Date\.now\(\)' "$HELPER"; then MISSING+=("unique schema id"); fi
  if ! grep -qE '"prisma"' "$HELPER" \
      || ! grep -qE '"db"' "$HELPER" \
      || ! grep -qE '"push"' "$HELPER"; then MISSING+=("prisma db push"); fi
  if [ "${#MISSING[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — $HELPER missing required pieces:"
    printf '        %s\n' "${MISSING[@]}"
    PASS=false
  fi
fi

echo "[3.A2] No file: or .sqlite URL remains in apps/api/tests/"
LEFTOVER_FILES=()
while IFS= read -r f; do
  LEFTOVER_FILES+=("$f")
done < <(grep -rlE '\.sqlite\b|\bfile:\$\{' apps/api/tests/ 2>/dev/null || true)
if [ "${#LEFTOVER_FILES[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — tests still build file: URLs:"
  printf '        %s\n' "${LEFTOVER_FILES[@]}"
  PASS=false
fi

echo "[3.A3] CLI E2E helper routes through the Postgres helper"
# Test execution is enforced by goals/_meta.gates.sh (M.3); we only
# verify the structural import here.
CLI_HELPER=apps/cli/tests/e2e-cli/helpers.ts
if [ ! -f "$CLI_HELPER" ]; then
  echo "    ✗ fail — $CLI_HELPER missing"
  PASS=false
elif ! grep -qE 'postgres-db' "$CLI_HELPER"; then
  echo "    ✗ fail — $CLI_HELPER does not import the Postgres helper"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[3.A4] persistence-matrix tests route through the Postgres helper"
# Iterate every persistence-matrix-*.test.ts: each must import the
# Postgres helper (directly or via persistence-matrix-helpers.ts), and
# the full suite must be green against Postgres. Every Prisma model
# must appear in at least one matrix file.
MATRIX_FILES=()
while IFS= read -r f; do
  MATRIX_FILES+=("$f")
done < <(find apps/api/tests/integration -maxdepth 1 -name 'persistence-matrix-*.test.ts' -type f 2>/dev/null | sort)
MATRIX_SUPPORT=apps/api/tests/integration/persistence-matrix-helpers.ts
if [ "${#MATRIX_FILES[@]}" -eq 0 ]; then
  echo "    ✗ fail — no apps/api/tests/integration/persistence-matrix-*.test.ts files"
  PASS=false
else
  PG_GAPS=()
  for f in "${MATRIX_FILES[@]}"; do
    # A file routes through Postgres if it imports postgres-db directly
    # or imports the shared helpers module (which itself imports postgres-db).
    if grep -qE 'postgres-db' "$f"; then continue; fi
    if grep -qE 'persistence-matrix-helpers' "$f" \
        && [ -f "$MATRIX_SUPPORT" ] \
        && grep -qE 'postgres-db' "$MATRIX_SUPPORT"; then continue; fi
    PG_GAPS+=("$f")
  done

  MODELS=$(grep -E '^model ' apps/api/prisma/schema.prisma | awk '{print $2}')
  MISSING_REFS=()
  for m in $MODELS; do
    if ! grep -lq "\b${m}\b" "${MATRIX_FILES[@]}"; then
      MISSING_REFS+=("$m")
    fi
  done

  if [ "${#PG_GAPS[@]}" -ne 0 ]; then
    echo "    ✗ fail — these matrix files do not route through the Postgres helper:"
    printf '        %s\n' "${PG_GAPS[@]}"
    PASS=false
  elif [ "${#MISSING_REFS[@]}" -ne 0 ]; then
    echo "    ✗ fail — no persistence-matrix-*.test.ts file references these models:"
    printf '        %s\n' "${MISSING_REFS[@]}"
    PASS=false
  else
    # Test execution is enforced by goals/_meta.gates.sh (M.3); we only
    # verify structural shape (helper routing + per-model references).
    echo "    ✓ pass (${#MATRIX_FILES[@]} files, every model referenced)"
  fi
fi

echo "[3.A5] Every server-spawning test imports the Postgres helper"
SPAWN_VIOLATORS=()
while IFS= read -r f; do
  # files that both spawn a child process AND set DATABASE_URL but DON'T
  # import the helper are the violators.
  if grep -q 'DATABASE_URL' "$f" && ! grep -q 'postgres-db' "$f"; then
    SPAWN_VIOLATORS+=("$f")
  fi
done < <(grep -rlE '\bspawn\s*\(' apps/api/tests/ 2>/dev/null || true)
# The helper file itself is allowed to mention DATABASE_URL without
# importing itself.
FILTERED=()
if [ "${#SPAWN_VIOLATORS[@]}" -gt 0 ]; then
  for f in "${SPAWN_VIOLATORS[@]}"; do
    case "$f" in
      apps/api/tests/helpers/postgres-db.ts) ;;
      *) FILTERED+=("$f") ;;
    esac
  done
fi
if [ "${#FILTERED[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these spawn a server without using the helper:"
  printf '        %s\n' "${FILTERED[@]}"
  PASS=false
fi

# ─── Tranche B — Production schema is Postgres ───────────────────────────

echo "[3.B1] Provider is postgresql and no sqlite literal remains"
PROVIDER=$(grep -E 'provider\s*=\s*"(postgresql|postgres|sqlite|mysql|mongodb|sqlserver|cockroachdb)"' apps/api/prisma/schema.prisma | head -1 | sed -E 's/.*"([a-z]+)".*/\1/')
if [ "$PROVIDER" != "postgresql" ]; then
  echo "    ✗ fail — apps/api/prisma/schema.prisma provider is '$PROVIDER' (want postgresql)"
  PASS=false
else
  SQLITE_HITS=()
  for d in "${SQLITE_FORBIDDEN_DIRS[@]}"; do
    while IFS= read -r line; do
      [ -n "$line" ] && SQLITE_HITS+=("$line")
    done < <(grep -rinE '\bsqlite\b' "$d" 2>/dev/null || true)
  done
  for f in "${SQLITE_FORBIDDEN_FILES[@]}"; do
    [ -f "$f" ] || continue
    while IFS= read -r line; do
      [ -n "$line" ] && SQLITE_HITS+=("${f}: ${line}")
    done < <(grep -inE '\bsqlite\b' "$f" 2>/dev/null || true)
  done
  if [ "${#SQLITE_HITS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — 'sqlite' literal still appears:"
    printf '        %s\n' "${SQLITE_HITS[@]}" | head -20
    PASS=false
  fi
fi

run_gate "3.B2 DB config consistency" "$ROOT/scripts/check-db-consistency.sh"

echo "[3.B3] Dockerfile runs migrations on container boot"
if [ ! -f Dockerfile ]; then
  echo "    ✗ fail — Dockerfile missing"
  PASS=false
elif ! grep -qE 'prisma db push' Dockerfile; then
  echo "    ✗ fail — Dockerfile does not run 'prisma db push' on boot"
  PASS=false
else
  echo "    ✓ pass"
fi

if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "[3.B4 Managed-DB deploy]"
  echo "    ⚠ skipped (VSPEC_GATES_SKIP_DEEP=1)"
else
  run_gate "3.B4 Managed-DB deploy" "$ROOT/scripts/check-managed-db.sh"
fi

# ─── Tranche C — CI runs the suite against Postgres ──────────────────────

echo "[3.C1] CI workflow file exists"
CI_FILES=()
while IFS= read -r f; do
  CI_FILES+=("$f")
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)
if [ "${#CI_FILES[@]}" -eq 0 ]; then
  echo "    ✗ fail — no workflow under .github/workflows/"
  PASS=false
else
  echo "    ✓ pass (${#CI_FILES[@]} workflow file(s))"
fi

echo "[3.C2] At least one workflow declares a postgres service"
HAS_PG=false
if [ "${#CI_FILES[@]}" -gt 0 ]; then
  for f in "${CI_FILES[@]}"; do
    if grep -qE 'postgres:16|image:\s*postgres' "$f" 2>/dev/null \
        && grep -qiE 'pg_isready|health' "$f" 2>/dev/null; then
      HAS_PG=true
      break
    fi
  done
fi
if [ "$HAS_PG" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no workflow declares postgres:16* with a healthcheck"
  PASS=false
fi

echo "[3.C3] CI runs lint, typecheck, test, and completion-check"
MISSING_STEPS=()
HAS_LINT=false
HAS_TYPECHECK=false
HAS_TEST=false
HAS_COMPLETION=false
if [ "${#CI_FILES[@]}" -gt 0 ]; then
  for f in "${CI_FILES[@]}"; do
    grep -qE 'npm (run )?lint|npx eslint' "$f" 2>/dev/null && HAS_LINT=true
    grep -qE 'npm (run )?typecheck|tsc --noEmit' "$f" 2>/dev/null && HAS_TYPECHECK=true
    grep -qE 'pnpm test|npm (run )?test|vitest run' "$f" 2>/dev/null && HAS_TEST=true
    grep -qE 'completion-check\.sh' "$f" 2>/dev/null && HAS_COMPLETION=true
  done
fi
[ "$HAS_LINT" = true ]       || MISSING_STEPS+=("lint")
[ "$HAS_TYPECHECK" = true ]  || MISSING_STEPS+=("typecheck")
[ "$HAS_TEST" = true ]       || MISSING_STEPS+=("test")
[ "$HAS_COMPLETION" = true ] || MISSING_STEPS+=("completion-check.sh")
if [ "${#MISSING_STEPS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — CI workflows missing steps: ${MISSING_STEPS[*]}"
  PASS=false
fi

run_gate "3.C4 CI workflow YAML parses" "$ROOT/scripts/check-ci.sh"

# ─── Tranche D — Meta: gate rigor ────────────────────────────────────────
# Prior-goal regression is enforced by scripts/completion-check.sh.

run_gate "3.D1 Gate rigor" "$ROOT/scripts/check-gate-rigor.sh $ROOT/goals/3-managed-db.md"

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
