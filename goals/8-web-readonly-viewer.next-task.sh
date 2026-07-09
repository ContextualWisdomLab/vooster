#!/usr/bin/env bash
# goals/8-web-readonly-viewer.next-task.sh — Task hints for goal 8
# (Web Read-Only Viewer on Vercel).
#
# Walks the agent through the Recommended Order of Attack:
# A retarget → A scaffold → B pages → C auth → D playwright → E vercel → F rigor.
# Surfaces the first failing sub-gate.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_DIR=apps/app
WEB_PKG=apps/app/package.json
WEB_APP_DIR=apps/app/app
WEB_TESTS_DIR=apps/app/tests/e2e-web
WEB_PLAYWRIGHT_CONFIG=apps/app/playwright.config.ts
WEB_VERCEL_CONFIG=apps/app/vercel.ts
GOAL5_MD=goals/5-monorepo.md
GOAL5_GATES=goals/5-monorepo.gates.sh
VERCEL_PROJECT_NAME=vooster-new-web

TIER1_PAGES=(
  'app/(app)/page.tsx'
  app/login/page.tsx
  'app/(app)/projects/[key]/page.tsx'
  'app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
)

AUTH_PAGES=(
  'app/(app)/page.tsx'
  'app/(app)/projects/[key]/page.tsx'
  'app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
)

APP_LAYOUT='app/(app)/layout.tsx'

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

# ─── A1: Goal 5 retarget (must come first) ───────────────────────────────
if grep -qE 'exactly three subdirectories' "$GOAL5_MD" \
    || ! grep -qE '\bweb\b' "$GOAL5_MD"; then
  cat <<'EOF'
TASK: Goal 5 retarget commit (gate 8.A1, prerequisite to everything else).

  This is a CASE (b) change per docs/goal-design.md §5: Goal 5's A3
  invariant text says "exactly three subdirectories" and lists three
  app names. Adding apps/app changes the declared set, so both the
  prior .md text AND the gate enumeration must move together in a
  single scoped commit.

  Edit goals/5-monorepo.md A3:
    - "exactly three subdirectories: api, cli, www"
        → "exactly four subdirectories: api, cli, web, www"
    - Update any nearby prose that enumerates the set (look at the
      "Tranche A — Workspace topology" intro too).

  Edit goals/5-monorepo.gates.sh A3:
    - Find the ACTUAL_APPS comparison block
    - Update the expected sorted set from "api cli www" to "api cli web www"

  DO NOT mix any apps/app scaffold work into this commit. The
  retarget is its own atomic change.

  Commit:
    refactor(goal-5): admit apps/app to A3 declared set
EOF
  exit 0
fi

# ─── A2: apps/app/package.json + name ────────────────────────────────────
A2_OK=false
if [ -f "$WEB_PKG" ]; then
  if node -e "
    const m = require('./$WEB_PKG');
    if (m.name !== '@vooster/app') process.exit(1);
    if (m.private !== true) process.exit(2);
  " 2>/dev/null; then
    A2_OK=true
  fi
fi
if [ "$A2_OK" = false ]; then
  cat <<'EOF'
TASK: Scaffold apps/app with a Next.js 15 manifest (gate 8.A2).

  Create apps/app/package.json:

    {
      "name": "@vooster/app",
      "version": "0.0.0",
      "private": true,
      "scripts": {
        "build": "next build",
        "dev": "next dev",
        "start": "next start",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "test:e2e": "playwright test"
      },
      "dependencies": {
        "next": "^15.0.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@playwright/test": "^1.49.0",
        "@types/node": "^20.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "autoprefixer": "^10.4.0",
        "postcss": "^8.4.0",
        "tailwindcss": "^3.4.0",
        "typescript": "^5.5.0",
        "vitest": "^2.0.0"
      }
    }

  Then: pnpm install

  Commit:
    chore(web): scaffold @vooster/app workspace
EOF
  exit 0
fi

# ─── A3: Next.js 15 dependency ───────────────────────────────────────────
if ! node -e "
  const m = require('./$WEB_PKG');
  const v = (m.dependencies && m.dependencies.next) || '';
  if (!/^(\^|~|>=)?15\./.test(v)) process.exit(1);
" 2>/dev/null; then
  cat <<'EOF'
TASK: Pin next@^15.x (gate 8.A3).

  apps/app/package.json must declare next at a major-15 version.
  Update the dependency entry and re-run pnpm install.

  Commit:
    chore(web): pin next@^15
EOF
  exit 0
fi

# ─── A4: every config file present ───────────────────────────────────────
A4_MISSING=()
for cfg in "${CONFIG_FILES[@]}"; do
  if [ ! -f "$WEB_DIR/$cfg" ]; then
    A4_MISSING+=("$cfg")
  fi
done
if [ "${#A4_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Add the missing Next.js config files (gate 8.A4).

  Missing under $WEB_DIR/:
EOF
  printf '    %s\n' "${A4_MISSING[@]}"
  cat <<'EOF'

  Skeletons:

    tsconfig.json
      Use the Next.js 15 defaults (strict, jsx: preserve, paths,
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]).

    next.config.ts
      import type { NextConfig } from "next";
      const config: NextConfig = { reactStrictMode: true };
      export default config;

    tailwind.config.ts
      import type { Config } from "tailwindcss";
      const config: Config = {
        content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"]
      };
      export default config;

    postcss.config.mjs
      export default { plugins: { tailwindcss: {}, autoprefixer: {} } };

  Commit:
    chore(web): next.js 15 + tailwind config scaffolding
EOF
  exit 0
fi

# ─── A5: scripts declared ────────────────────────────────────────────────
A5_MISSING=()
for script in "${PKG_SCRIPTS[@]}"; do
  if ! node -e "
    const m = require('./$WEB_PKG');
    if (!m.scripts || !m.scripts['$script']) process.exit(1);
  " 2>/dev/null; then
    A5_MISSING+=("$script")
  fi
done
if [ "${#A5_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Declare every required script in apps/app/package.json (gate 8.A5).

  Missing scripts: ${A5_MISSING[*]}

  Goal 5 B6 enumerates every workspace app and requires build/test/
  typecheck. This goal adds test:e2e for Playwright. Make sure all
  four exist.

  Commit:
    chore(web): declare build/test/typecheck/test:e2e scripts
EOF
  exit 0
fi

# ─── A6: build succeeds (deep) ───────────────────────────────────────────
if [ "${VSPEC_NEXT_TASK_DEEP:-}" = "1" ]; then
  if ! pnpm --filter @vooster/app build >/dev/null 2>&1 \
      || [ ! -d "$WEB_DIR/.next" ]; then
    cat <<'EOF'
TASK: pnpm --filter @vooster/app build must produce .next/ (gate 8.A6).

  Run:
    pnpm --filter @vooster/app build

  Investigate the build error. Likely causes:
    - app/layout.tsx missing (Next.js App Router requires it)
    - Type errors (run pnpm --filter @vooster/app typecheck)
    - Missing dependency

  Minimal app/layout.tsx:
    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="ko"><body>{children}</body></html>
      );
    }

  Commit:
    feat(web): app router root layout (or other fix)
EOF
    exit 0
  fi
fi

# ─── B1: every Tier-1 page exists ────────────────────────────────────────
B1_MISSING=()
for page in "${TIER1_PAGES[@]}"; do
  if [ ! -f "$WEB_DIR/$page" ]; then
    B1_MISSING+=("$page")
  fi
done
if [ "${#B1_MISSING[@]}" -gt 0 ]; then
  NEXT_PAGE="${B1_MISSING[0]}"
  cat <<EOF
TASK: Author the next Tier-1 page (gate 8.B1).

  Create: $WEB_DIR/$NEXT_PAGE

  Implementation rules:
    - Server Component (NO "use client" at top of file)
    - Server-side fetch via the API_URL env var
    - Forward the vspec_session cookie via Next.js cookies()

  Skeleton (adapt to the page's role):

    import { cookies } from "next/headers";
    import { redirect } from "next/navigation";

    export default async function Page(/* { params }: { params: Promise<{...}> } */) {
      const cookieStore = await cookies();
      const session = cookieStore.get("vspec_session")?.value;
      if (!session) redirect("/login");

      const res = await fetch(\`\${process.env.API_URL}/v1/...\`, {
        headers: { Cookie: \`vspec_session=\${session}\` },
        cache: "no-store"
      });
      if (!res.ok) throw new Error("...");
      const data = await res.json();

      return <main>{/* render data */}</main>;
    }

  For app/page.tsx (home): minimal landing redirecting authenticated
  users to /projects.
  For app/login/page.tsx: a link to "/v1/auth/github/start" — see C1.

  Remaining pages after this one:
EOF
  printf '    %s\n' "${B1_MISSING[@]:1}"
  cat <<EOF

  Commit:
    feat(web): ${NEXT_PAGE} page
EOF
  exit 0
fi

# ─── B2: Server Component check ──────────────────────────────────────────
B2_OFFENDERS=()
for page in "${TIER1_PAGES[@]}"; do
  f="$WEB_DIR/$page"
  if [ -f "$f" ]; then
    first=$(awk 'NF && $0 !~ /^[[:space:]]*\/\// { print; exit }' "$f" \
            | tr -d '\r')
    if echo "$first" | grep -qiE '^[[:space:]]*"use client"'; then
      B2_OFFENDERS+=("$page")
    fi
  fi
done
if [ "${#B2_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Tier-1 pages must be Server Components (gate 8.B2).

  Remove the "use client" directive from these pages. Move
  interactive logic into a nested client component imported by the
  Server Component if needed.

  Offenders:
EOF
  printf '    %s\n' "${B2_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    refactor(web): pages back to Server Components
EOF
  exit 0
fi

# ─── B3: UC detail field coverage ────────────────────────────────────────
UC_DETAIL_DIR="$WEB_DIR/app/(app)/projects/[key]/usecases/[ucKey]"
B3_MISSING=()
if [ -d "$UC_DETAIL_DIR" ]; then
  for field in "${UC_FIELDS[@]}"; do
    if ! grep -rqE "\\b${field}\\b" "$UC_DETAIL_DIR" 2>/dev/null; then
      B3_MISSING+=("$field")
    fi
  done
fi
if [ "${#B3_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: UC detail page must render every Cockburn field (gate 8.B3).

  Missing fields in $UC_DETAIL_DIR:
    ${B3_MISSING[*]}

  Each identifier must appear at least once in the subtree (either
  in page.tsx or in a component file imported by it). The gate greps
  on the field name as a word — using it as a property accessor
  (e.g., useCase.primary_actor) counts.

  Fields and their semantics:
    title                  — the UC title (verb phrase)
    primary_actor          — the actor that initiates the UC
    level                  — user-goal | subfunction | summary
    status                 — DRAFT | IN_REVIEW | APPROVED | ARCHIVED
    main_scenario          — array of steps
    extensions             — array of extension flows
    stakeholder_interests  — array of {stakeholder, interest} pairs

  Commit:
    feat(web): render every Cockburn field on UC detail
EOF
  exit 0
fi

# ─── C1: login link ──────────────────────────────────────────────────────
LOGIN_PAGE="$WEB_DIR/app/login/page.tsx"
if ! grep -qE '/v1/auth/github/start' "$LOGIN_PAGE"; then
  cat <<EOF
TASK: Login page must link to the GitHub OAuth start (gate 8.C1).

  In $LOGIN_PAGE:

    export default function LoginPage() {
      const apiUrl = process.env.API_URL ?? "";
      return (
        <main>
          <h1>vspec</h1>
          <a href={\`\${apiUrl}/v1/auth/github/start\`}>
            Sign in with GitHub
          </a>
        </main>
      );
    }

  The existing /v1/auth/github/start endpoint sets the vspec_session
  cookie on its callback path; since the API and web are same-site
  in production (subdomain of the same registrable domain), the
  cookie is automatically attached to subsequent requests. For local
  dev, configure the API_URL env var to point at the dev API server.

  Commit:
    feat(web): login page with github oauth link
EOF
  exit 0
fi

# ─── C2: server fetches forward cookie ───────────────────────────────────
C2_OFFENDERS=()
if [ -d "$WEB_APP_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f" && ! grep -qE '\bcookies\(' "$f"; then
      C2_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_APP_DIR" \( -name '*.ts' -o -name '*.tsx' \) -type f 2>/dev/null)
fi
if [ "${#C2_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Every server fetch must forward the vspec_session cookie (gate 8.C2).

  Files that call fetch( without referencing cookies():
EOF
  printf '    %s\n' "${C2_OFFENDERS[@]}"
  cat <<'EOF'

  Pattern (Next.js 15 async cookies):

    import { cookies } from "next/headers";

    const cookieStore = await cookies();
    const session = cookieStore.get("vspec_session")?.value;
    if (!session) { /* redirect or throw */ }

    const res = await fetch(url, {
      headers: { Cookie: `vspec_session=${session}` },
      cache: "no-store"
    });

  If a file legitimately should not call fetch (e.g., a layout that
  only renders chrome), remove the fetch instead of adding cookies.

  Commit:
    feat(web): forward vspec_session on every server fetch
EOF
  exit 0
fi

# ─── C3: auth pages share the redirect-enforcing (app) layout ────────────
C3_OFFENDERS=()
APP_LAYOUT_FILE="$WEB_DIR/$APP_LAYOUT"
LAYOUT_REDIRECT_OK=false
if [ -f "$APP_LAYOUT_FILE" ] \
    && grep -qE 'redirect\(' "$APP_LAYOUT_FILE" \
    && grep -qE '/login' "$APP_LAYOUT_FILE"; then
  LAYOUT_REDIRECT_OK=true
fi
for page in "${AUTH_PAGES[@]}"; do
  f="$WEB_DIR/$page"
  if [ ! -f "$f" ]; then
    C3_OFFENDERS+=("$page (missing)")
    continue
  fi
  case "$page" in
    'app/(app)/'*) : ;;
    *) C3_OFFENDERS+=("$page (outside the (app) route group)") ;;
  esac
done
if [ "$LAYOUT_REDIRECT_OK" = false ]; then
  C3_OFFENDERS+=("$APP_LAYOUT (no redirect( + /login)")
fi
if [ "${#C3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Authenticated routes must share the redirect-enforcing (app) layout. See
goals/8-web-readonly-viewer.md § "Tranche C — Auth (session-cookie reuse)".

Offenders:
EOF
  printf '    %s\n' "${C3_OFFENDERS[@]}"
  exit 0
fi

# ─── D1: playwright config chromium-only ─────────────────────────────────
D1_OK=false
if [ -f "$WEB_PLAYWRIGHT_CONFIG" ]; then
  if grep -qE 'name:[[:space:]]*["'\''"]chromium["'\''"]' "$WEB_PLAYWRIGHT_CONFIG" \
      && ! grep -qE 'name:[[:space:]]*["'\''"](firefox|webkit)["'\''"]' \
            "$WEB_PLAYWRIGHT_CONFIG"; then
    D1_OK=true
  fi
fi
if [ "$D1_OK" = false ]; then
  cat <<'EOF'
TASK: Configure Playwright with chromium only (gate 8.D1).

  Create apps/app/playwright.config.ts:

    import { defineConfig } from "@playwright/test";

    export default defineConfig({
      testDir: "./tests/e2e-web",
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 1 : 0,
      reporter: "list",
      use: {
        baseURL: "http://127.0.0.1:3000",
        trace: "on-first-retry"
      },
      projects: [{ name: "chromium", use: { browserName: "chromium" } }],
      webServer: {
        command: "pnpm dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        env: { VSPEC_AUTH_STUB: "1" }
      }
    });

  Install playwright browsers:
    pnpm --filter @vooster/app exec playwright install chromium

  Commit:
    chore(web): playwright config (chromium only)
EOF
  exit 0
fi

# ─── D2: every Tier-1 page has a matching test ───────────────────────────
D2_MISSING=()
for page in "${TIER1_PAGES[@]}"; do
  route="${page#app}"
  route="${route%/page.tsx}"
  route=$(echo "$route" | sed -E 's#/\([^)]+\)##g')
  route="${route:-/}"
  route_pattern=$(echo "$route" | sed -E 's#\[[^]]+\]#[^"'\'']+#g')
  if [ -d "$WEB_TESTS_DIR" ]; then
    if ! grep -rqE "page\\.goto\\([[:space:]]*[\"'][^\"']*${route_pattern}" \
         "$WEB_TESTS_DIR" 2>/dev/null; then
      D2_MISSING+=("$page (route ${route})")
    fi
  else
    D2_MISSING+=("$page (no $WEB_TESTS_DIR)")
  fi
done
if [ "${#D2_MISSING[@]}" -gt 0 ]; then
  NEXT_TEST="${D2_MISSING[0]}"
  cat <<EOF
TASK: Author a Playwright test for the next uncovered page (gate 8.D2).

  Uncovered: $NEXT_TEST

  Create a *.spec.ts under $WEB_TESTS_DIR/ that uses page.goto on a
  URL matching the page's route. For dynamic segments, seed the API
  with the needed entities (workspace, project, UC) via a beforeEach
  that drives the CLI or the API — but the test body must interact
  only via the browser (page.goto, page.click, expect(page)).

  Pattern:
    import { test, expect } from "@playwright/test";

    test("renders <page>", async ({ page }) => {
      // (seed if needed; setup goes outside the spec or in beforeEach)
      await page.goto("/<route>");
      await expect(page.getByText(/<expected marker>/)).toBeVisible();
    });

  Remaining uncovered after this one:
EOF
  printf '    %s\n' "${D2_MISSING[@]:1}"
  cat <<'EOF'

  Commit:
    test(web-e2e): cover <page>
EOF
  exit 0
fi

# ─── D3: no fetch( in tests ──────────────────────────────────────────────
D3_OFFENDERS=()
if [ -d "$WEB_TESTS_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      D3_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_TESTS_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#D3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Drop fetch( from Playwright tests (gate 8.D3).

  Browser-only interaction. If seed is needed, move it out of the
  test file (e.g., into a setup script invoked outside the test
  process — or seed via the API in a globalSetup that lives outside
  the e2e-web directory).

  Offenders:
EOF
  printf '    %s\n' "${D3_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    test(web-e2e): browser-only interactions
EOF
  exit 0
fi

# ─── D4: VSPEC_AUTH_STUB referenced ──────────────────────────────────────
CONFIG_SETS_STUB=false
if [ -f "$WEB_PLAYWRIGHT_CONFIG" ] \
    && grep -qE 'VSPEC_AUTH_STUB' "$WEB_PLAYWRIGHT_CONFIG"; then
  CONFIG_SETS_STUB=true
fi
D4_OFFENDERS=()
if [ "$CONFIG_SETS_STUB" = false ] && [ -d "$WEB_TESTS_DIR" ]; then
  while IFS= read -r f; do
    if ! grep -qE 'VSPEC_AUTH_STUB' "$f"; then
      D4_OFFENDERS+=("$f")
    fi
  done < <(find "$WEB_TESTS_DIR" -name '*.spec.ts' -type f 2>/dev/null)
fi
if [ "$CONFIG_SETS_STUB" = false ] && [ "${#D4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Set VSPEC_AUTH_STUB=1 in Playwright config (gate 8.D4).

  In apps/app/playwright.config.ts inside webServer.env, add:
    VSPEC_AUTH_STUB: "1"

  Setting it once in the config covers every spec via the launched
  dev server's env. Alternatively, set it per-test, but the config
  approach is cleaner.

  Commit:
    chore(web): set VSPEC_AUTH_STUB in playwright webServer env
EOF
  exit 0
fi

# ─── D5: playwright run passes (deep) ────────────────────────────────────
if [ "${VSPEC_NEXT_TASK_DEEP:-}" = "1" ]; then
  if ! pnpm --filter @vooster/app test:e2e >/dev/null 2>&1; then
    cat <<'EOF'
TASK: pnpm --filter @vooster/app test:e2e must pass (gate 8.D5).

  Run:
    pnpm --filter @vooster/app test:e2e

  Diagnose the failures one by one. Likely causes:
    - playwright browsers not installed:
        pnpm --filter @vooster/app exec playwright install chromium
    - dev server fails to start (check that the API is reachable
      from the dev server, or that pages handle API_URL absence
      gracefully)
    - seed data missing for dynamic routes

  Commit:
    fix(web-e2e): <specific fix>
EOF
    exit 0
  fi
fi

# ─── E1: vercel.ts exists with framework: nextjs ─────────────────────────
if [ ! -f "$WEB_VERCEL_CONFIG" ] \
    || ! grep -qE 'framework:[[:space:]]*["'\''"]nextjs["'\''"]' \
         "$WEB_VERCEL_CONFIG"; then
  cat <<'EOF'
TASK: Create apps/app/vercel.ts (gate 8.E1).

  Per the latest Vercel guidance, prefer vercel.ts over vercel.json:

    import type { VercelConfig } from "@vercel/config/v1";

    export const config: VercelConfig = {
      framework: "nextjs",
      buildCommand: "pnpm --filter @vooster/app build",
      installCommand: "pnpm install --frozen-lockfile",
      // The Vercel project is `vooster-new-web`. Linking happens via
      // `vercel link` in this directory (or the dashboard).
    };

  Install the type package:
    pnpm --filter @vooster/app add -D @vercel/config

  Commit:
    chore(web): vercel.ts config (next.js framework)
EOF
  exit 0
fi

# ─── E2: project name marker ─────────────────────────────────────────────
if ! grep -rqE "${VERCEL_PROJECT_NAME}" "$WEB_DIR" 2>/dev/null; then
  cat <<EOF
TASK: Record the Vercel project name in apps/app/ (gate 8.E2).

  Add a comment or constant in apps/app/vercel.ts (or a sibling
  README) referencing $VERCEL_PROJECT_NAME, so the gate has a
  committed marker for the project it must inspect.

  Example, inside vercel.ts:

    // Vercel project: $VERCEL_PROJECT_NAME
    // Link with: cd apps/app && vercel link --project $VERCEL_PROJECT_NAME

  Commit:
    chore(web): record vercel project name
EOF
  exit 0
fi

# ─── E3 / E4: deployment status + github link (deep) ─────────────────────
if [ "${VSPEC_NEXT_TASK_DEEP:-}" = "1" ]; then
  if ! command -v vercel >/dev/null 2>&1; then
    cat <<'EOF'
TASK: Install the Vercel CLI (gate 8.E3/E4 preconditions).

  Run:
    pnpm dlx vercel@54.21.1 --version

  The exact version avoids latest-tag drift while checking local tooling access.

  No commit yet — this is local tooling.
EOF
    exit 0
  fi
  if ! vercel whoami >/dev/null 2>&1; then
    cat <<'EOF'
TASK: Authenticate the Vercel CLI (gate 8.E3/E4 preconditions).

  Run:
    vercel login

  Choose the account that owns the vooster-new-web project. The gate
  will skip with an actionable hint until auth succeeds.

  No commit — local auth state.
EOF
    exit 0
  fi
  LS_OUT=$(vercel ls "$VERCEL_PROJECT_NAME" 2>&1 || true)
  if ! echo "$LS_OUT" \
       | grep -E '(Production|Preview)' \
       | head -n 1 \
       | grep -qE '● Ready'; then
    cat <<EOF
TASK: Create the Vercel project and produce a Ready deployment (gate 8.E3).

  Steps:
    1. cd apps/app
    2. vercel link
       - Scope: sumin-chois-projects (or your scope)
       - Project: $VERCEL_PROJECT_NAME (create if absent)
       - Connect to this GitHub repo (the link wizard prompts).
    3. Push to the linked branch (Vercel auto-deploys), or run
       'vercel --prod' from apps/app to trigger a deployment.
    4. Verify:
         vercel ls $VERCEL_PROJECT_NAME
       The first row's Status column should show '● Ready'.

  If the deployment fails (red Error status):
    - Inspect the build log: vercel inspect --logs <deployment-url>
    - Common failure: monorepo install. Make sure vercel.ts
      installCommand and Vercel project's "Root Directory" setting
      agree (Root Directory should be apps/app; install runs from
      the repo root via pnpm workspaces).

  No commit yet — this is platform state. Re-run the gate once
  deployment is Ready.

  Current vercel ls output:
EOF
    echo "$LS_OUT" | head -n 10 | sed 's/^/    /'
    exit 0
  fi
  INSPECT_OUT=$(vercel project inspect "$VERCEL_PROJECT_NAME" 2>&1 || true)
  if ! echo "$INSPECT_OUT" | grep -qiE 'github'; then
    cat <<EOF
TASK: Link the Vercel project to the GitHub repository (gate 8.E4).

  Run:
    vercel link --project $VERCEL_PROJECT_NAME

  Or in the Vercel dashboard:
    Project Settings → Git → Connect Git Repository → choose this repo.

  Verify:
    vercel project inspect $VERCEL_PROJECT_NAME
  should mention the GitHub repo path.

  No commit — platform state.
EOF
    exit 0
  fi
fi

# ─── F1: gate rigor ──────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/8-web-readonly-viewer.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-gate-rigor.sh green for goal 8 (gate 8.F1).

  Add a for/while/find loop that enumerates the missing claim's
  source of truth. Do not silence the check.

  Commit:
    chore(goal-8): enumerate <claim> in gate suite
EOF
  exit 0
fi

# ─── All gates green ─────────────────────────────────────────────────────
cat <<'EOF'
TASK: All sub-gates of goal 8 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/9-*.md or stop.
EOF
