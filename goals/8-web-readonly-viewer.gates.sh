#!/usr/bin/env bash
# goals/8-web-readonly-viewer.gates.sh — Gate suite for goal 8
# (Web Read-Only Viewer on Vercel).
#
# Anti-cheat principle: every "every X" claim in
# goals/8-web-readonly-viewer.md enumerates a source of truth — the
# declared page set, the declared config-file set, the declared script
# set, the declared UC field set, every *.spec.ts under e2e-web/, every
# *.ts(x) under app/. A single hand-fix does not pass.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="8-web-readonly-viewer"

# Inputs that determine this goal's gate result.
GATE_INPUTS=(
  apps/web
  goals/5-monorepo.md
  goals/5-monorepo.gates.sh
  goals/8-web-readonly-viewer.gates.sh
  goals/8-web-readonly-viewer.md
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

# ─── Sources of truth ────────────────────────────────────────────────────
WEB_DIR=apps/web
WEB_PKG=apps/web/package.json
WEB_APP_DIR=apps/web/app
WEB_TESTS_DIR=apps/web/tests/e2e-web
WEB_PLAYWRIGHT_CONFIG=apps/web/playwright.config.ts
WEB_VERCEL_CONFIG=apps/web/vercel.ts
GOAL5_MD=goals/5-monorepo.md
VERCEL_PROJECT_NAME=vooster-new-web

TIER1_PAGES=(
  app/page.tsx
  app/login/page.tsx
  app/projects/page.tsx
  app/projects/[key]/page.tsx
  app/projects/[key]/usecases/[ucKey]/page.tsx
)

AUTH_PAGES=(
  app/projects/page.tsx
  app/projects/[key]/page.tsx
  app/projects/[key]/usecases/[ucKey]/page.tsx
)

CONFIG_FILES=(
  tsconfig.json
  next.config.ts
  tailwind.config.ts
  postcss.config.mjs
)

PKG_SCRIPTS=(build test typecheck test:e2e)

UC_FIELDS=(
  title
  primary_actor
  level
  status
  main_scenario
  extensions
  stakeholder_interests
)

# ─── Tranche A — Workspace integration ───────────────────────────────────

echo "[8.A1 goal 5 A3 prose admits web alongside api/cli/www]"
A1_MISSING=()
for app in api cli web www; do
  # Look in the A3 paragraph specifically — between the "A3." marker
  # and the next blank line, or use a wide grep over the .md file.
  if ! grep -qE "\\b${app}\\b" "$GOAL5_MD"; then
    A1_MISSING+=("$app")
  fi
done
# Tighter check: the literal "exactly three" must be gone.
A1_TIGHT_OK=true
if grep -qE 'exactly three subdirectories' "$GOAL5_MD"; then
  A1_TIGHT_OK=false
fi
if [ "${#A1_MISSING[@]}" -eq 0 ] && [ "$A1_TIGHT_OK" = true ]; then
  echo "    ✓ pass"
else
  if [ "${#A1_MISSING[@]}" -gt 0 ]; then
    echo "    ✗ fail — $GOAL5_MD A3 prose missing references to: ${A1_MISSING[*]}"
  fi
  if [ "$A1_TIGHT_OK" = false ]; then
    echo "    ✗ fail — $GOAL5_MD still says 'exactly three subdirectories' (retarget incomplete)"
  fi
  PASS=false
fi

echo "[8.A2 apps/web/package.json declares @vooster/web]"
A2_OK=false
if [ -f "$WEB_PKG" ]; then
  if node -e "
    const m = require('./$WEB_PKG');
    if (m.name !== '@vooster/web') { process.exit(1); }
    if (m.private !== true) { process.exit(2); }
  " 2>/dev/null; then
    A2_OK=true
  fi
fi
if [ "$A2_OK" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WEB_PKG missing or name != '@vooster/web' or not private"
  PASS=false
fi

echo "[8.A3 apps/web depends on Next.js 15]"
A3_OK=false
if [ -f "$WEB_PKG" ]; then
  if node -e "
    const m = require('./$WEB_PKG');
    const v = (m.dependencies && m.dependencies.next) || '';
    if (!/^(\^|~|>=)?15\./.test(v)) { process.exit(1); }
  " 2>/dev/null; then
    A3_OK=true
  fi
fi
if [ "$A3_OK" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WEB_PKG does not depend on next@^15.x"
  PASS=false
fi

echo "[8.A4 every Next.js config file is present at apps/web/]"
A4_MISSING=()
for cfg in "${CONFIG_FILES[@]}"; do
  if [ ! -f "$WEB_DIR/$cfg" ]; then
    A4_MISSING+=("$cfg")
  fi
done
if [ "${#A4_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing config files in $WEB_DIR/: ${A4_MISSING[*]}"
  PASS=false
fi

echo "[8.A5 every required script declared in apps/web/package.json]"
A5_MISSING=()
if [ -f "$WEB_PKG" ]; then
  for script in "${PKG_SCRIPTS[@]}"; do
    if ! node -e "
      const m = require('./$WEB_PKG');
      if (!m.scripts || !m.scripts['$script']) { process.exit(1); }
    " 2>/dev/null; then
      A5_MISSING+=("$script")
    fi
  done
else
  A5_MISSING=("${PKG_SCRIPTS[@]}")
fi
if [ "${#A5_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WEB_PKG missing scripts: ${A5_MISSING[*]}"
  PASS=false
fi

echo "[8.A6 pnpm --filter @vooster/web build produces .next/]"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
elif [ ! -f "$WEB_PKG" ]; then
  echo "    ✗ fail — preconditions unmet (no $WEB_PKG)"
  PASS=false
else
  if pnpm --filter @vooster/web build >/dev/null 2>&1 \
      && [ -d "$WEB_DIR/.next" ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — pnpm --filter @vooster/web build did not produce $WEB_DIR/.next/"
    PASS=false
  fi
fi

# ─── Tranche B — Read-only viewer pages ──────────────────────────────────

echo "[8.B1 every Tier-1 page file exists]"
B1_MISSING=()
for page in "${TIER1_PAGES[@]}"; do
  if [ ! -f "$WEB_DIR/$page" ]; then
    B1_MISSING+=("$page")
  fi
done
if [ "${#B1_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing pages under $WEB_DIR/: ${B1_MISSING[*]}"
  PASS=false
fi

echo "[8.B2 every Tier-1 page is a Server Component]"
B2_OFFENDERS=()
for page in "${TIER1_PAGES[@]}"; do
  f="$WEB_DIR/$page"
  if [ -f "$f" ]; then
    # Read the first non-empty, non-comment line; flag if it is the
    # "use client" directive.
    first=$(awk 'NF && $0 !~ /^[[:space:]]*\/\// { print; exit }' "$f" \
            | tr -d '\r')
    if echo "$first" | grep -qiE '^[[:space:]]*"use client"'; then
      B2_OFFENDERS+=("$page")
    fi
  fi
done
if [ "${#B2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these pages open with \"use client\":"
  printf '        %s\n' "${B2_OFFENDERS[@]}"
  PASS=false
fi

echo "[8.B3 UC detail page renders every Cockburn field]"
B3_MISSING=()
UC_DETAIL_DIR="$WEB_DIR/app/projects/[key]/usecases/[ucKey]"
if [ -d "$UC_DETAIL_DIR" ]; then
  for field in "${UC_FIELDS[@]}"; do
    if ! grep -rqE "\\b${field}\\b" "$UC_DETAIL_DIR" 2>/dev/null; then
      B3_MISSING+=("$field")
    fi
  done
else
  B3_MISSING=("${UC_FIELDS[@]}")
fi
if [ "${#B3_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — UC detail subtree missing fields: ${B3_MISSING[*]}"
  PASS=false
fi

echo "[8.B4 no write API call in apps/web/app/]"
B4_OFFENDERS=()
if [ -d "$WEB_APP_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE 'method:[[:space:]]*["'"'"'](POST|PUT|PATCH|DELETE)["'"'"']' "$f"; then
      B4_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_APP_DIR" \( -name '*.ts' -o -name '*.tsx' \) -type f 2>/dev/null)
fi
if [ "${#B4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — write API calls found in:"
  printf '        %s\n' "${B4_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche C — Auth ────────────────────────────────────────────────────

echo "[8.C1 login page links to /v1/auth/github/start]"
LOGIN_PAGE="$WEB_DIR/app/login/page.tsx"
if [ -f "$LOGIN_PAGE" ] && grep -qE '/v1/auth/github/start' "$LOGIN_PAGE"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $LOGIN_PAGE missing or no reference to /v1/auth/github/start"
  PASS=false
fi

echo "[8.C2 every server fetch forwards the vspec_session cookie]"
C2_OFFENDERS=()
if [ -d "$WEB_APP_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f" && ! grep -qE '\bcookies\(' "$f"; then
      C2_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_APP_DIR" \( -name '*.ts' -o -name '*.tsx' \) -type f 2>/dev/null)
fi
if [ "${#C2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — files calling fetch( without cookies():"
  printf '        %s\n' "${C2_OFFENDERS[@]}"
  PASS=false
fi

echo "[8.C3 every authenticated page redirects to /login when unauthed]"
C3_OFFENDERS=()
for page in "${AUTH_PAGES[@]}"; do
  f="$WEB_DIR/$page"
  if [ -f "$f" ]; then
    if ! grep -qE 'redirect\(' "$f" || ! grep -qE '/login' "$f"; then
      C3_OFFENDERS+=("$page")
    fi
  else
    C3_OFFENDERS+=("$page (missing)")
  fi
done
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these auth pages do not redirect to /login:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche D — Playwright E2E ──────────────────────────────────────────

echo "[8.D1 playwright.config.ts declares chromium only]"
D1_OK=false
if [ -f "$WEB_PLAYWRIGHT_CONFIG" ]; then
  if grep -qE 'name:[[:space:]]*["'\''"]chromium["'\''"]' "$WEB_PLAYWRIGHT_CONFIG" \
      && ! grep -qE 'name:[[:space:]]*["'\''"](firefox|webkit)["'\''"]' \
            "$WEB_PLAYWRIGHT_CONFIG"; then
    D1_OK=true
  fi
fi
if [ "$D1_OK" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WEB_PLAYWRIGHT_CONFIG missing chromium-only declaration"
  PASS=false
fi

echo "[8.D2 every Tier-1 page has a matching Playwright test]"
D2_MISSING=()
for page in "${TIER1_PAGES[@]}"; do
  # Convert e.g. app/projects/page.tsx → /projects
  #         app/projects/[key]/page.tsx → /projects/  (dynamic segment lenient)
  #         app/page.tsx → /
  route="${page#app}"
  route="${route%/page.tsx}"
  route="${route:-/}"
  # Replace dynamic [seg] with a wildcard match for the regex
  route_pattern=$(echo "$route" | sed -E 's#\[[^]]+\]#[^"'\'']+#g')
  if [ -d "$WEB_TESTS_DIR" ]; then
    # Test files must contain page.goto with a path that matches the route.
    if ! grep -rqE "page\\.goto\\([[:space:]]*[\"'][^\"']*${route_pattern}" \
         "$WEB_TESTS_DIR" 2>/dev/null; then
      D2_MISSING+=("$page (route ${route})")
    fi
  else
    D2_MISSING+=("$page (no $WEB_TESTS_DIR)")
  fi
done
if [ "${#D2_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no Playwright test covers:"
  printf '        %s\n' "${D2_MISSING[@]}"
  PASS=false
fi

echo "[8.D3 no fetch( calls in e2e-web tests]"
D3_OFFENDERS=()
if [ -d "$WEB_TESTS_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      D3_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_TESTS_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#D3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — test files calling fetch( directly:"
  printf '        %s\n' "${D3_OFFENDERS[@]}"
  PASS=false
fi

echo "[8.D4 every Playwright spec references VSPEC_AUTH_STUB]"
D4_OFFENDERS=()
# Allow the reference to live in playwright.config.ts (webServer.env)
# OR in the spec file itself.
CONFIG_SETS_STUB=false
if [ -f "$WEB_PLAYWRIGHT_CONFIG" ] \
    && grep -qE 'VSPEC_AUTH_STUB' "$WEB_PLAYWRIGHT_CONFIG"; then
  CONFIG_SETS_STUB=true
fi
if [ -d "$WEB_TESTS_DIR" ]; then
  while IFS= read -r f; do
    if [ "$CONFIG_SETS_STUB" = true ]; then
      continue
    fi
    if ! grep -qE 'VSPEC_AUTH_STUB' "$f"; then
      D4_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_TESTS_DIR" -name '*.spec.ts' -type f 2>/dev/null)
fi
if [ "${#D4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — VSPEC_AUTH_STUB not referenced by config or by:"
  printf '        %s\n' "${D4_OFFENDERS[@]}"
  PASS=false
fi

echo "[8.D5 pnpm --filter @vooster/web test:e2e exits 0]"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
elif [ ! -f "$WEB_PLAYWRIGHT_CONFIG" ]; then
  echo "    ✗ fail — preconditions unmet (no $WEB_PLAYWRIGHT_CONFIG)"
  PASS=false
else
  if pnpm --filter @vooster/web test:e2e >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — pnpm --filter @vooster/web test:e2e exits non-zero"
    PASS=false
  fi
fi

# ─── Tranche E — Vercel deployment ───────────────────────────────────────

echo "[8.E1 apps/web/vercel.ts exists with framework: nextjs]"
if [ -f "$WEB_VERCEL_CONFIG" ] \
    && grep -qE 'framework:[[:space:]]*["'\''"]nextjs["'\''"]' \
         "$WEB_VERCEL_CONFIG"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WEB_VERCEL_CONFIG missing or no framework: \"nextjs\""
  PASS=false
fi

echo "[8.E2 Vercel project name $VERCEL_PROJECT_NAME is recorded in apps/web/]"
if grep -rqE "${VERCEL_PROJECT_NAME}" "$WEB_DIR" 2>/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — string '$VERCEL_PROJECT_NAME' not found anywhere under $WEB_DIR"
  PASS=false
fi

echo "[8.E3 latest production deployment of $VERCEL_PROJECT_NAME is Ready]"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
elif ! command -v vercel >/dev/null 2>&1; then
  echo "    ⊘ skipped — vercel CLI not on PATH"
  echo "       (install with: npm i -g vercel@latest)"
elif ! vercel whoami >/dev/null 2>&1; then
  echo "    ⊘ skipped — vercel CLI not authenticated"
  echo "       (run: vercel login)"
else
  # `vercel ls <project>` prints a table with a Status column whose
  # value for ready deployments contains "● Ready". Grab the first
  # production row and check.
  LS_OUT=$(vercel ls "$VERCEL_PROJECT_NAME" 2>&1)
  if echo "$LS_OUT" \
       | grep -E '(Production|Preview)' \
       | head -n 1 \
       | grep -qE '● Ready'; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — latest deployment of $VERCEL_PROJECT_NAME is not Ready"
    echo "       (run: vercel ls $VERCEL_PROJECT_NAME)"
    PASS=false
  fi
fi

echo "[8.E4 Vercel project $VERCEL_PROJECT_NAME is GitHub-linked]"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
elif ! command -v vercel >/dev/null 2>&1; then
  echo "    ⊘ skipped — vercel CLI not on PATH"
elif ! vercel whoami >/dev/null 2>&1; then
  echo "    ⊘ skipped — vercel CLI not authenticated"
else
  INSPECT_OUT=$(vercel project inspect "$VERCEL_PROJECT_NAME" 2>&1 || true)
  PROJECT_JSON=$(vercel api "/v9/projects/$VERCEL_PROJECT_NAME" 2>&1 || true)
  # The output mentions the linked Git repo when the project is GitHub-
  # connected. Accept either the explicit "github" type marker or the
  # repo URL/path in the inspect output.
  if echo "$INSPECT_OUT" | grep -qiE 'github' \
      || echo "$PROJECT_JSON" | tr -d '[:space:]' | grep -qiE '"type":"github"'; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — vercel project inspect $VERCEL_PROJECT_NAME shows no github link"
    echo "       (link via: cd $WEB_DIR && vercel link, or in the Vercel dashboard)"
    PASS=false
  fi
fi

# ─── Tranche F — Meta: rigor ─────────────────────────────────────────────

echo "[8.F1 Gate rigor on goal 8 markdown]"
if bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/8-web-readonly-viewer.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/8-web-readonly-viewer.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
