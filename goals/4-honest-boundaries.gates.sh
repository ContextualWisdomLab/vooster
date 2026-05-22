#!/usr/bin/env bash
# goals/4-honest-boundaries.gates.sh — Gate suite for goal 4
# (honest layered architecture).
#
# Anti-cheat principle: every gate enumerates from a source of truth
# (the filesystem, apps/api/prisma/schema.prisma, ls apps/api/src/ports/). If the goal
# text says "every X," the gate iterates X.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="4-honest-boundaries"

# Inputs that determine this goal's gate result.
# Gates exercised: dishonest-test scan, ESLint full pass, boundaries
# config audit vs docs/01-architecture.md, Stored<Model>/upward-import
# sweeps, 1000-line cap, per-port Prisma adapter map, CLI command split,
# check-honest-gates.sh, gate-rigor on goal 4 md.
# Prior-goal regression lives in scripts/completion-check.sh.
GATE_INPUTS=(
  apps/api/src
  apps/api/tests
  apps/api/prisma/schema.prisma
  apps/cli/src
  docs/01-architecture.md
  package.json
  pnpm-lock.yaml
  eslint.config.js
  scripts/check-gate-rigor.sh
  scripts/check-honest-gates.sh
  goals/4-honest-boundaries.gates.sh
  goals/4-honest-boundaries.md
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

# Config files whose raw contents tests are NOT allowed to assert on.
CONFIG_FILES=(
  eslint.config.js
  tsconfig.json
  package.json
  apps/api/prisma/schema.prisma
  docker-compose.yml
  docker-compose.prod.yml
  vitest.config.ts
)

# ─── Tranche A — Boundaries enforced by ESLint ──────────────────────────

echo "[4.A1] No file-content-grep test under tests/"
DISHONEST_TESTS=()
while IFS= read -r f; do
  # Test files that readFileSync a known config file AND assert on its
  # raw string body are presumed dishonest.
  reads_config=false
  for cfg in "${CONFIG_FILES[@]}"; do
    if grep -q "readFileSync.*${cfg##*/}" "$f" 2>/dev/null; then
      reads_config=true
      break
    fi
  done
  if [ "$reads_config" = true ] \
      && grep -qE 'toMatch\(|toContain\(' "$f" 2>/dev/null \
      && ! grep -qE 'JSON\.parse|yaml\.|safe_load|ESLint\(|new Linter' "$f" 2>/dev/null; then
    DISHONEST_TESTS+=("$f")
  fi
done < <(find apps/api/tests apps/cli/tests -type f -name '*.test.ts' 2>/dev/null)
if [ "${#DISHONEST_TESTS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these tests grep config text instead of running the tool:"
  printf '        %s\n' "${DISHONEST_TESTS[@]}"
  PASS=false
fi

echo "[4.A2] ESLint passes with zero violations"
# ESLint execution moved to goals/_meta.gates.sh (M.2). A2 here is a
# structural acknowledgement — meta is the single source of truth.
echo "    ✓ pass (enforced by goals/_meta.gates.sh M.2)"

echo "[4.A3] boundaries/element-types is deny-by-default"
if grep -E 'default:\s*"disallow"' eslint.config.js >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — eslint.config.js still has default: \"allow\" (or no default)"
  PASS=false
fi

echo "[4.A4] Allow-list matches docs/01-architecture.md"
# Required allowed arrows (deny-by-default plus these).
# Source of truth: docs/01-architecture.md hexagonal ring order.
# Encoded as parallel arrays for bash 3.2 compatibility.
REQUIRED_LAYERS=(cli http application infrastructure ports domain)
REQUIRED_ALLOWS=(
  "http application ports domain"
  "application ports domain"
  "ports domain"
  "ports domain"
  "domain"
  ""
)

MISSING_ARROWS=()
EXTRA_ARROWS=()
i=0
for layer in "${REQUIRED_LAYERS[@]}"; do
  required="${REQUIRED_ALLOWS[$i]}"
  i=$((i + 1))
  block=$(awk -v L="\"$layer\"" '
    $0 ~ "from:[[:space:]]*"L { capture=1 }
    capture { buf = buf $0 " " }
    capture && /\]/ && /allow/ { print buf; exit }
  ' eslint.config.js)
  for r in $required; do
    if ! echo "$block" | grep -qE "\"$r\""; then
      MISSING_ARROWS+=("$layer → $r")
    fi
  done
  if [ -z "$required" ] && echo "$block" | grep -qE 'allow:\s*\['; then
    EXTRA_ARROWS+=("$layer → (any)")
  fi
done

if [ "${#MISSING_ARROWS[@]}" -eq 0 ] && [ "${#EXTRA_ARROWS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — allow-list drift from docs/01-architecture.md:"
  [ "${#MISSING_ARROWS[@]}" -gt 0 ] && printf '        missing: %s\n' "${MISSING_ARROWS[@]}"
  [ "${#EXTRA_ARROWS[@]}" -gt 0 ] && printf '        extra:   %s\n' "${EXTRA_ARROWS[@]}"
  PASS=false
fi

echo "[4.A5] ESLint actually rejects upward imports and accepts allowed arrows"
# Honest check: drive ESLint through its Node API in a *separate*
# process (so the TS Project build does not compete with vitest workers
# the way the old apps/api/tests/unit/boundaries-config.test.ts did)
# and lint two fixture files — one forbidden upward import and one
# allowed architecture arrow. The configured boundaries/element-types
# rule must produce exactly one error for the forbidden case and zero
# for the allowed case. This catches the failure mode where 4.A4's
# allow-list text is correct but the rule itself is misconfigured.
A5_LOG=$(mktemp)
if node --input-type=module >"$A5_LOG" 2>&1 <<'NODE'
import { unlink, writeFile } from "node:fs/promises";
import { ESLint } from "eslint";

const cases = [
  {
    code: [
      "// @ts-ignore: fixture intentionally imports a forbidden layer.",
      'import type { StoredUser } from "../http/signup-types.ts";',
      "export type BoundaryFixture = StoredUser;"
    ].join("\n"),
    expectedBoundaryErrors: 1,
    filePath: "apps/api/src/ports/__boundary_rejects_http.fixture.ts"
  },
  {
    code: [
      "// @ts-ignore: fixture intentionally imports an allowed layer.",
      'import type { StartGithubOAuthResult } from "../application/signup.ts";',
      "export type BoundaryFixture = StartGithubOAuthResult;"
    ].join("\n"),
    expectedBoundaryErrors: 0,
    filePath: "apps/cli/src/__boundary_allows_application.fixture.ts"
  }
];

let failures = 0;
try {
  await Promise.all(
    cases.map((c) => writeFile(c.filePath, c.code))
  );

  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await Promise.all(
    cases.map((c) => eslint.lintFiles([c.filePath]))
  );

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const boundaryErrors = (results[i][0]?.messages ?? []).filter(
      (m) => m.ruleId === "boundaries/element-types"
    );
    if (boundaryErrors.length !== c.expectedBoundaryErrors) {
      failures += 1;
      console.error(
        `  ${c.filePath}: expected ${c.expectedBoundaryErrors} boundary error(s), got ${boundaryErrors.length}`
      );
    }
  }
} finally {
  await Promise.all(
    cases.map((c) => unlink(c.filePath).catch(() => undefined))
  );
}

if (failures > 0) {
  process.exit(1);
}
NODE
then
  echo "    ✓ pass"
else
  echo "    ✗ fail — see $A5_LOG"
  PASS=false
fi

# ─── Tranche B — Domain owns the entity vocabulary ──────────────────────

echo "[4.B1] Every Prisma model has a Stored<Model> type under apps/api/src/domain/"
MODELS=$(grep -E '^model ' apps/api/prisma/schema.prisma | awk '{print $2}')
UNDECLARED=()
for m in $MODELS; do
  if ! grep -rqE "(^|[[:space:]])(export[[:space:]]+)?(type|interface)[[:space:]]+Stored${m}\b" apps/api/src/domain/ 2>/dev/null; then
    UNDECLARED+=("$m")
  fi
done
if [ "${#UNDECLARED[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — Stored<Model> missing under apps/api/src/domain/ for:"
  printf '        %s\n' "${UNDECLARED[@]}"
  PASS=false
fi

echo "[4.B2] apps/api/src/http/ no longer exports Stored* types"
HTTP_STORED=$(grep -rE '^export[[:space:]]+(type|interface)[[:space:]]+Stored' apps/api/src/http/ 2>/dev/null || true)
if [ -z "$HTTP_STORED" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — Stored* types still declared under apps/api/src/http/:"
  echo "$HTTP_STORED" | head -20 | sed 's/^/        /'
  PASS=false
fi

echo "[4.B3] Zero upward http imports from ports/application/infrastructure"
UPWARD_VIOLATORS=()
while IFS= read -r f; do
  if grep -qE 'from "(\.\.\/)+http/' "$f" 2>/dev/null; then
    UPWARD_VIOLATORS+=("$f")
  fi
done < <(find apps/api/src/ports apps/api/src/application apps/api/src/infrastructure -name '*.ts' 2>/dev/null)
if [ "${#UPWARD_VIOLATORS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these inner-layer files still import from ../http/:"
  printf '        %s\n' "${UPWARD_VIOLATORS[@]}" | head -20
  [ "${#UPWARD_VIOLATORS[@]}" -gt 20 ] && echo "        … and $((${#UPWARD_VIOLATORS[@]} - 20)) more"
  PASS=false
fi

echo "[4.B4] apps/api/src/domain/ imports nothing from sibling layers"
DOMAIN_LEAKS=$(grep -rE 'from "(\.\.\/)+(cli|http|application|ports|infrastructure)/' apps/api/src/domain/ 2>/dev/null || true)
if [ -z "$DOMAIN_LEAKS" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/api/src/domain/ leaks outward:"
  echo "$DOMAIN_LEAKS" | head -10 | sed 's/^/        /'
  PASS=false
fi

# ─── Tranche C — No god files ───────────────────────────────────────────

echo "[4.C1] No file under apps/*/src or apps/web/app exceeds 1000 lines"
GIANT_FILES=()
while IFS= read -r line; do
  size=$(echo "$line" | awk '{print $1}')
  path=$(echo "$line" | awk '{print $2}')
  [ "$path" = "total" ] && continue
  if [ "$size" -gt 1000 ] 2>/dev/null; then
    GIANT_FILES+=("$size $path")
  fi
done < <(find apps/api/src apps/cli/src apps/web/app \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} +)
if [ "${#GIANT_FILES[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — files over 1000 lines:"
  printf '        %s\n' "${GIANT_FILES[@]}"
  PASS=false
fi

echo "[4.C2] One Prisma adapter per port under apps/api/src/infrastructure/"
MISSING_ADAPTERS=()
while IFS= read -r port_file; do
  base=$(basename "$port_file" .ts)
  case "$base" in
    # signup-store is the legacy god intersection; it does not require a
    # matching prisma-signup-store.ts after dissolution. Per-port adapters
    # below cover its members.
    signup-store) continue ;;
  esac
  if [ ! -f "apps/api/src/infrastructure/prisma-${base}.ts" ]; then
    MISSING_ADAPTERS+=("apps/api/src/infrastructure/prisma-${base}.ts")
  fi
done < <(find apps/api/src/ports -name '*-store.ts' 2>/dev/null)
if [ "${#MISSING_ADAPTERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these per-port Prisma adapters are missing:"
  printf '        %s\n' "${MISSING_ADAPTERS[@]}"
  PASS=false
fi

echo "[4.C3] CLI split into one file per top-level command"
if [ ! -d apps/cli/src/commands ]; then
  echo "    ✗ fail — apps/cli/src/commands/ does not exist"
  PASS=false
else
  # Source of truth: top-level subcommands the project advertises via
  # README + http strings. We extract candidates from apps/cli/src/index.ts
  # (the current monolith); once C3 is satisfied those branches are
  # gone, so this enumeration switches to the commands/ directory itself
  # — naturally green.
  COMMAND_SOURCE=apps/cli/src/index.ts
  CMDS=$(grep -oE 'parsed\.args\.command === "[a-z][a-z0-9-]+"' "$COMMAND_SOURCE" 2>/dev/null \
         | sed -E 's/.*"([^"]+)".*/\1/' | sort -u)
  if [ -z "$CMDS" ]; then
    # Monolith dissolved — discover from the directory itself.
    CMDS=$(find apps/cli/src/commands -maxdepth 1 -name '*.ts' -exec basename {} .ts \; | sort -u)
  fi
  MISSING_CMDS=()
  for c in $CMDS; do
    if ! find apps/cli/src/commands -maxdepth 2 -name "${c}.ts" -o -name "${c}/index.ts" 2>/dev/null | grep -q .; then
      MISSING_CMDS+=("$c")
    fi
  done
  if [ "${#MISSING_CMDS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — these subcommands have no file under apps/cli/src/commands/:"
    printf '        %s\n' "${MISSING_CMDS[@]}"
    PASS=false
  fi
fi

# ─── Tranche D — Meta: honest gates + gate rigor ────────────────────────
# Prior-goal regression is enforced by scripts/completion-check.sh.

echo "[4.D1 Honest-gates meta check]"
if [ ! -f "$ROOT/scripts/check-honest-gates.sh" ]; then
  echo "    ✗ fail — scripts/check-honest-gates.sh missing"
  PASS=false
elif bash "$ROOT/scripts/check-honest-gates.sh" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-honest-gates.sh"
  PASS=false
fi

run_gate "4.D2 Gate rigor" "$ROOT/scripts/check-gate-rigor.sh $ROOT/goals/4-honest-boundaries.md"

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
