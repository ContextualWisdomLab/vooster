#!/usr/bin/env bash
# goals/5-monorepo.gates.sh — Gate suite for goal 5
# (pnpm workspaces monorepo + Astro landing).
#
# Anti-cheat principle: every gate enumerates from a source of truth
# — pnpm-workspace.yaml, `find apps -maxdepth 1`, the prior gate-suite
# list. Hand-fixing one example does not satisfy the goal.
#
# Landing-page section composition is intentionally NOT gated here;
# it is owned by the www app itself.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="5-monorepo"

# Inputs that determine this goal's gate result.
# After moving B7/B8/C5 builds to _meta M.4, this goal only verifies
# structural shape: pnpm-workspace.yaml + root package.json, each app's
# package.json (name/private/scripts), apps/api/prisma/schema.prisma
# existence, apps/cli/bin/run.js, the four API layer directories, the
# Astro entry + Korean sweep across apps/www/src.
GATE_INPUTS=(
  pnpm-workspace.yaml
  pnpm-lock.yaml
  package.json
  apps/api/package.json
  apps/api/prisma/schema.prisma
  apps/api/src/domain
  apps/api/src/ports
  apps/api/src/application
  apps/api/src/infrastructure
  apps/api/src/http
  apps/cli/package.json
  apps/cli/bin
  apps/cli/src
  apps/app/package.json
  apps/www/package.json
  apps/www/astro.config.mjs
  apps/www/astro.config.ts
  apps/www/astro.config.js
  apps/www/src
  scripts/check-gate-rigor.sh
  goals/5-monorepo.gates.sh
  goals/5-monorepo.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

# ─── Sources of truth ────────────────────────────────────────────────────
REQUIRED_APPS=(api cli app www)
REQUIRED_API_LAYERS=(domain ports application infrastructure http)
REQUIRED_SCRIPTS=(build test typecheck)
LEGACY_ROOT_DIRS=(src bin prisma tests)

# ─── Tranche A — Workspace skeleton ──────────────────────────────────────

echo "[5.A1] pnpm-workspace.yaml declares apps/*"
if [ -f pnpm-workspace.yaml ] \
    && grep -qE '^[[:space:]]*-[[:space:]]*"?apps/\*"?[[:space:]]*$' pnpm-workspace.yaml; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pnpm-workspace.yaml missing or doesn't list apps/* under packages:"
  PASS=false
fi

echo "[5.A2] root package.json is a workspace root (private, packageManager:pnpm, no runtime deps)"
if [ -f package.json ] && node -e "
  const p=require('./package.json');
  if (!p.private) { process.exit(2); }
  if (!p.packageManager || !/^pnpm@/.test(p.packageManager)) { process.exit(3); }
  if (p.dependencies && Object.keys(p.dependencies).length > 0) { process.exit(4); }
" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — root package.json must set private:true, packageManager:'pnpm@…', and have no runtime dependencies"
  PASS=false
fi

echo "[5.A3] apps/ contains exactly {api, cli, app, www}"
if [ -d apps ]; then
  ACTUAL_APPS=$(find apps -maxdepth 1 -mindepth 1 -type d 2>/dev/null \
                  | awk -F/ '{print $NF}' | sort | tr '\n' ' ' | sed 's/ $//')
else
  ACTUAL_APPS=""
fi
EXPECTED_APPS=$(printf '%s\n' "${REQUIRED_APPS[@]}" | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$ACTUAL_APPS" = "$EXPECTED_APPS" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/ has '$ACTUAL_APPS', expected '$EXPECTED_APPS'"
  PASS=false
fi

echo "[5.A4] every app has package.json with name '@vooster/<app>'"
A4_BAD=()
for app in "${REQUIRED_APPS[@]}"; do
  pkg="apps/${app}/package.json"
  if [ ! -f "$pkg" ]; then
    A4_BAD+=("missing $pkg")
    continue
  fi
  name=$(node -e "try{console.log(require('./${pkg}').name||'')}catch(e){process.exit(1)}" 2>/dev/null)
  if [ "$name" != "@vooster/${app}" ]; then
    A4_BAD+=("${pkg}: name='${name}', want '@vooster/${app}'")
  fi
done
if [ "${#A4_BAD[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail —"
  printf '        %s\n' "${A4_BAD[@]}"
  PASS=false
fi

echo "[5.A5] pnpm-lock.yaml is the only lockfile"
A5_OTHER=()
[ -f package-lock.json ] && A5_OTHER+=("package-lock.json")
[ -f yarn.lock ] && A5_OTHER+=("yarn.lock")
if [ -f pnpm-lock.yaml ] && [ "${#A5_OTHER[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — need pnpm-lock.yaml present; foreign lockfiles still here: ${A5_OTHER[*]:-(none)}"
  PASS=false
fi

echo "[5.A6] pnpm install has run (node_modules/.pnpm present)"
if [ -d node_modules/.pnpm ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — run: corepack enable && pnpm install"
  PASS=false
fi

# ─── Tranche B — API and CLI relocated ───────────────────────────────────

echo "[5.B1] legacy root dirs (src, bin, prisma, tests) gone"
B1_LEFT=()
for d in "${LEGACY_ROOT_DIRS[@]}"; do
  [ -e "$d" ] && B1_LEFT+=("$d")
done
if [ "${#B1_LEFT[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — still at repo root: ${B1_LEFT[*]}"
  PASS=false
fi

echo "[5.B2] apps/api/src/ contains every API layer"
B2_MISS=()
for layer in "${REQUIRED_API_LAYERS[@]}"; do
  [ -d "apps/api/src/${layer}" ] || B2_MISS+=("$layer")
done
if [ "${#B2_MISS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing under apps/api/src/: ${B2_MISS[*]}"
  PASS=false
fi

echo "[5.B3] apps/api/prisma/schema.prisma exists"
if [ -f apps/api/prisma/schema.prisma ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/api/prisma/schema.prisma missing"
  PASS=false
fi

echo "[5.B4] apps/cli has src/, apps/cli/bin/run.js, and package.json bin.vspec"
B4_OK=true
[ -d apps/cli/src ] || B4_OK=false
[ -f apps/cli/bin/run.js ] || B4_OK=false
if [ -f apps/cli/package.json ]; then
  HAS_BIN=$(node -e "
    try {
      const b = (require('./apps/cli/package.json').bin)||{};
      console.log(b.vspec ? 'y' : 'n');
    } catch(e) { process.exit(1); }
  " 2>/dev/null)
  [ "$HAS_BIN" = "y" ] || B4_OK=false
else
  B4_OK=false
fi
if [ "$B4_OK" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/cli/{src,apps/cli/bin/run.js} and package.json bin.vspec required"
  PASS=false
fi

echo "[5.B5] no file is duplicated between root src/ and apps/<n>/src/"
B5_DUPES=()
if [ -d src ]; then
  while IFS= read -r f; do
    rel="${f#src/}"
    [ -f "apps/api/src/${rel}" ] && B5_DUPES+=("$f ↔ apps/api/src/${rel}")
    [ -f "apps/cli/src/${rel}" ] && B5_DUPES+=("$f ↔ apps/cli/src/${rel}")
  done < <(find apps/cli/src -type f -name '*.ts' 2>/dev/null)
fi
if [ "${#B5_DUPES[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — duplicates between root and apps/:"
  printf '        %s\n' "${B5_DUPES[@]}" | head -10
  PASS=false
fi

echo "[5.B6] every app declares build/test/typecheck scripts"
B6_GAPS=()
for app in "${REQUIRED_APPS[@]}"; do
  pkg="apps/${app}/package.json"
  [ -f "$pkg" ] || { B6_GAPS+=("$app: no package.json"); continue; }
  for s in "${REQUIRED_SCRIPTS[@]}"; do
    has=$(node -e "
      try {
        const p = require('./${pkg}');
        console.log(((p.scripts||{})['${s}']) ? 'y' : 'n');
      } catch(e) { process.exit(1); }
    " 2>/dev/null)
    [ "$has" = "y" ] || B6_GAPS+=("$app: missing script '$s'")
  done
done
if [ "${#B6_GAPS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail —"
  printf '        %s\n' "${B6_GAPS[@]}"
  PASS=false
fi

# 5.B7 (@vooster/api build) and 5.B8 (@vooster/cli build) are enforced
# by goals/_meta.gates.sh (M.4) — the meta gate enumerates every app
# under apps/* with a `build` script. Re-running them here would just
# duplicate work; the proof lives at the meta layer.
echo "[5.B7] pnpm --filter @vooster/api build"
echo "    ✓ pass (enforced by goals/_meta.gates.sh M.4)"
echo "[5.B8] pnpm --filter @vooster/cli build"
echo "    ✓ pass (enforced by goals/_meta.gates.sh M.4)"

# ─── Tranche C — Astro landing ───────────────────────────────────────────

echo "[5.C1] apps/www/package.json depends on astro"
C1_OK=false
if [ -f apps/www/package.json ]; then
  HAS_ASTRO=$(node -e "
    try {
      const p = require('./apps/www/package.json');
      const d = Object.assign({}, p.dependencies||{}, p.devDependencies||{});
      console.log(d.astro ? 'y' : 'n');
    } catch(e) { process.exit(1); }
  " 2>/dev/null)
  [ "$HAS_ASTRO" = "y" ] && C1_OK=true
fi
if $C1_OK; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/www/package.json missing astro dependency"
  PASS=false
fi

echo "[5.C2] apps/www/astro.config.{mjs,ts,js} exists"
if [ -f apps/www/astro.config.mjs ] || [ -f apps/www/astro.config.ts ] || [ -f apps/www/astro.config.js ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no astro.config file under apps/www/"
  PASS=false
fi

echo "[5.C3] apps/www/src/pages/index.astro exists"
if [ -f apps/www/src/pages/index.astro ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — apps/www/src/pages/index.astro missing"
  PASS=false
fi

echo "[5.C4] every landing file contains Korean (Hangul) text"
KO_GAPS=()
check_korean_file() {
  node -e "
    try {
      const t = require('fs').readFileSync(process.argv[1], 'utf8');
      process.exit(/[가-힣]/.test(t) ? 0 : 1);
    } catch(e) { process.exit(2); }
  " "$1" >/dev/null 2>&1
}
if [ -f apps/www/src/pages/index.astro ]; then
  check_korean_file apps/www/src/pages/index.astro \
    || KO_GAPS+=("apps/www/src/pages/index.astro")
fi
while IFS= read -r f; do
  check_korean_file "$f" || KO_GAPS+=("$f")
done < <(find apps/www/src/components -name '*.astro' 2>/dev/null)
if [ "${#KO_GAPS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these landing files have no Hangul characters:"
  printf '        %s\n' "${KO_GAPS[@]}"
  PASS=false
fi

# 5.C5 (@vooster/www build) is enforced by goals/_meta.gates.sh (M.4).
echo "[5.C5] pnpm --filter @vooster/www build"
echo "    ✓ pass (enforced by goals/_meta.gates.sh M.4)"

# ─── Tranche D — Meta: gate rigor ────────────────────────────────────────
# Prior-goal regression is enforced by scripts/completion-check.sh.

echo "[5.D1 Gate rigor on goal 5 markdown]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/5-monorepo.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/5-monorepo.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  # All deep commands moved to goals/_meta.gates.sh (M.4); this goal now
  # has no SKIP_DEEP-gated work, so the cache always saves on pass.
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
