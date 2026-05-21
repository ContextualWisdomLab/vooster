#!/usr/bin/env bash
# goals/2-shippable.gates.sh — Gate suite for goal 2 (shippable vspec).
#
# Anti-cheat principle: every gate enumerates from a source of truth
# (apps/api/prisma/schema.prisma, the SignupState type, the filesystem) rather than
# hardcoding one example. If the goal text says "every X," the gate iterates
# X. This is the rule Goal 1's persistence gate violated.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="2-shippable"

if gate_cache_hit "$GOAL_NAME"; then
  echo "[cache hit] goal $GOAL_NAME passed at $(gate_cache_sha "$GOAL_NAME")"
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

# Whitelist of fields allowed to remain in SignupState (truly ephemeral).
SIGNUP_STATE_WHITELIST='^(pendingOAuth|sessionsByToken|readOnlyMemberships)$'

# Entity-name regex used for grep-leak scans across apps/api/src/http/*-routes.ts.
ROUTE_STATE_PATTERN='state\.(actorsBy|branchesBy|goalsBy|mergeRequestsBy|projectKeysBy|projectsBy|scenariosBy|stepLocksBy|stakeholdersBy|stakeholderInterestsBy|stepsBy|revisionsBy|usecasesBy|usersBy|workSessionsBy|workspaceArchivedAt|workspacesBy|workspaceSlugs)'

# ─── Tranche A — Persistence ─────────────────────────────────────────────

echo "[2.A1] No entity Maps remain in SignupState"
LEFTOVER=$(awk '/^export type SignupState = \{/,/^\};/' apps/api/src/http/signup-types.ts \
  | grep -E '^\s+[a-zA-Z]+\s*:\s*(Map|Set)<' \
  | awk -F: '{gsub(/^[ \t]+/,"",$1); print $1}' \
  | grep -vE "$SIGNUP_STATE_WHITELIST" || true)
if [ -z "$LEFTOVER" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these in-memory Maps must move to Prisma:"
  echo "$LEFTOVER" | sed 's/^/        /'
  PASS=false
fi

echo "[2.A2] No direct state.<entity> access in route files"
LEAKS=$(grep -nE "$ROUTE_STATE_PATTERN" apps/api/src/http/*-routes.ts 2>/dev/null || true)
if [ -z "$LEAKS" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — direct state access remains:"
  echo "$LEAKS" | head -10 | sed 's/^/        /'
  PASS=false
fi

echo "[2.A3] Every Prisma model has an adapter in apps/api/src/infrastructure/"
MODELS=$(grep -E '^model ' apps/api/prisma/schema.prisma | awk '{print $2}')
if [ -z "$MODELS" ]; then
  echo "    ✗ fail — apps/api/prisma/schema.prisma has no models"
  PASS=false
else
  UNUSED=()
  for m in $MODELS; do
    lower=$(echo "$m" | awk '{print tolower(substr($0,1,1)) substr($0,2)}')
    if ! grep -rq "prisma\.${lower}\." apps/api/src/infrastructure/ 2>/dev/null; then
      UNUSED+=("$m")
    fi
  done
  if [ "${#UNUSED[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — Prisma models with no adapter usage:"
    printf '        %s\n' "${UNUSED[@]}"
    PASS=false
  fi
fi

echo "[2.A4] persistence-matrix test enumerates every model"
MATRIX=apps/api/tests/integration/persistence-matrix.test.ts
if [ ! -f "$MATRIX" ]; then
  echo "    ✗ fail — missing $MATRIX"
  PASS=false
else
  MISSING_REFS=()
  for m in $MODELS; do
    if ! grep -q "\b${m}\b" "$MATRIX"; then
      MISSING_REFS+=("$m")
    fi
  done
  if [ "${#MISSING_REFS[@]}" -ne 0 ]; then
    echo "    ✗ fail — $MATRIX does not reference these models:"
    printf '        %s\n' "${MISSING_REFS[@]}"
    PASS=false
  elif ! pnpm exec vitest run "$MATRIX" >/dev/null 2>&1; then
    echo "    ✗ fail — $MATRIX is red"
    PASS=false
  else
    echo "    ✓ pass"
  fi
fi

# ─── Tranche B — Auth + Deploy ───────────────────────────────────────────

echo "[2.B1] GitHub OAuth without stub"
if ! grep -rq 'GITHUB_CLIENT_ID' apps/api/src/ 2>/dev/null; then
  echo "    ✗ fail — GITHUB_CLIENT_ID never read in apps/api/src/"
  PASS=false
elif [ ! -f apps/api/tests/e2e/UC-001-real-oauth.test.ts ]; then
  echo "    ✗ fail — apps/api/tests/e2e/UC-001-real-oauth.test.ts missing"
  PASS=false
elif ! pnpm exec vitest run apps/api/tests/e2e/UC-001-real-oauth.test.ts >/dev/null 2>&1; then
  echo "    ✗ fail — UC-001-real-oauth test red"
  PASS=false
else
  echo "    ✓ pass"
fi

run_gate "2.B2 DB config consistency" "$ROOT/scripts/check-db-consistency.sh"

DEEP_SKIPPED=false
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "[2.B3 Docker deploy]"
  echo "    ⚠ skipped (VSPEC_GATES_SKIP_DEEP=1)"
  DEEP_SKIPPED=true
else
  run_gate "2.B3 Docker deploy"         "$ROOT/scripts/check-deployable.sh"
fi

echo "[2.B4] README has Install / Run / Deploy sections"
MISSING_SECTIONS=()
for section in Install Run Deploy; do
  if ! grep -qE "^## ${section}\b" README.md 2>/dev/null; then
    MISSING_SECTIONS+=("$section")
  fi
done
if [ "${#MISSING_SECTIONS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — README.md missing sections: ${MISSING_SECTIONS[*]}"
  PASS=false
fi

# ─── Tranche C — Real layers ─────────────────────────────────────────────

echo "[2.C1] No apps/api/src/http/*-routes.ts exceeds 150 lines"
OVER=()
while IFS= read -r f; do
  lines=$(wc -l <"$f" | tr -d ' ')
  if [ "$lines" -gt 150 ]; then OVER+=("$f ($lines lines)"); fi
done < <(find apps/api/src/http -name '*-routes.ts' -type f)
if [ "${#OVER[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — route files over 150 lines:"
  printf '        %s\n' "${OVER[@]}"
  PASS=false
fi

echo "[2.C2] apps/api/src/application/ has ≥ 18 modules"
APP_COUNT=$(find apps/api/src/application -name '*.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$APP_COUNT" -ge 18 ]; then
  echo "    ✓ pass ($APP_COUNT modules)"
else
  echo "    ✗ fail — only $APP_COUNT application modules (need ≥ 18)"
  PASS=false
fi

echo "[2.C3] apps/api/tests/unit/application/ has ≥ 18 test files"
UNIT_COUNT=$(find apps/api/tests/unit/application -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNIT_COUNT" -ge 18 ]; then
  echo "    ✓ pass ($UNIT_COUNT tests)"
else
  echo "    ✗ fail — only $UNIT_COUNT unit tests under apps/api/tests/unit/application/"
  PASS=false
fi

echo "[2.C4] Boundary rules reject direct adapter→infrastructure imports"
if node --input-type=module <<'NODE' >/tmp/2-c4-boundaries.log 2>&1
import { unlink, writeFile } from "node:fs/promises";
import { ESLint } from "eslint";

const cases = [
  {
    code: [
      'import { createMemoryUserStore } from "../infrastructure/memory-user-store.ts";',
      "export const boundaryFixture = createMemoryUserStore;"
    ].join("\n"),
    filePath: "apps/api/src/http/__goal2_rejects_infrastructure.test-fixture.ts"
  },
  {
    code: [
      'import { createMemoryUserStore } from "../../api/src/infrastructure/memory-user-store.ts";',
      "export const boundaryFixture = createMemoryUserStore;"
    ].join("\n"),
    filePath: "apps/cli/src/__goal2_rejects_infrastructure.test-fixture.ts"
  }
];

try {
  await Promise.all(cases.map((lintCase) => writeFile(lintCase.filePath, lintCase.code)));
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await Promise.all(cases.map((lintCase) => eslint.lintFiles([lintCase.filePath])));

  for (const [index, result] of results.entries()) {
    const lintCase = cases[index];
    if (lintCase === undefined) {
      throw new Error(`Missing lint case for result ${String(index)}`);
    }
    const boundaryErrors = result[0]?.messages.filter(
      (message) => message.ruleId === "boundaries/element-types"
    );
    if (boundaryErrors?.length !== 1) {
      throw new Error(`${lintCase.filePath} was not rejected by boundaries/element-types`);
    }
  }
} finally {
  await Promise.all(cases.map((lintCase) => unlink(lintCase.filePath).catch(() => undefined)));
}
NODE
then
  echo "    ✓ pass"
else
  echo "    ✗ fail — ESLint did not reject both adapter→infrastructure fixtures"
  PASS=false
fi

# ─── Tranche D — Meta: no regression and gate rigor ──────────────────────

echo "[2.D1 No goal-0 regression]"
if bash "$ROOT/goals/0-init.gates.sh" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — goal 0 regressed"
  PASS=false
fi

echo "[2.D2 No goal-1 regression]"
if bash "$ROOT/goals/1-runnable.gates.sh" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — goal 1 regressed"
  PASS=false
fi

run_gate "2.D3 Gate rigor" "$ROOT/scripts/check-gate-rigor.sh $ROOT/goals/2-shippable.md"

if [ "$PASS" = true ]; then
  if [ "$DEEP_SKIPPED" = false ]; then
    gate_cache_save "$GOAL_NAME"
  fi
  exit 0
else
  exit 1
fi
