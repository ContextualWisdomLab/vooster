#!/usr/bin/env bash
# goals/5-monorepo.next-task.sh — Task hints for goal 5.
#
# Walks the agent through Tranches A → B → C → D and surfaces the first
# failing sub-gate. Mirrors the order enforced by goals/5-monorepo.md's
# Recommended Order of Attack.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REQUIRED_APPS=(api cli www)
REQUIRED_API_LAYERS=(domain ports application infrastructure http)
REQUIRED_SCRIPTS=(build test typecheck)
LEGACY_ROOT_DIRS=(src bin prisma tests)
PRIOR_GOALS=(0-init 1-runnable 2-shippable 3-managed-db 4-honest-boundaries)

# ─── A1: pnpm-workspace.yaml ─────────────────────────────────────────────
if [ ! -f pnpm-workspace.yaml ] \
    || ! grep -qE '^[[:space:]]*-[[:space:]]*"?apps/\*"?[[:space:]]*$' pnpm-workspace.yaml; then
  cat <<'EOF'
TASK: Create pnpm-workspace.yaml (gate 5.A1).

  Write a single file at the repo root:

      packages:
        - "apps/*"

  Then enable pnpm and bootstrap the workspace:

      corepack enable
      pnpm install

  Commit:
      chore(monorepo): pnpm-workspace.yaml + workspace bootstrap
EOF
  exit 0
fi

# ─── A2: root package.json shape ─────────────────────────────────────────
if ! node -e "
  const p=require('./package.json');
  if (!p.private) process.exit(2);
  if (!p.packageManager || !/^pnpm@/.test(p.packageManager)) process.exit(3);
  if (p.dependencies && Object.keys(p.dependencies).length > 0) process.exit(4);
" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Reshape the root package.json as a workspace root (gate 5.A2).

  Required fields:
    "private":         true
    "packageManager":  "pnpm@9.x"   (or current major)
    "dependencies":    (none — move runtime deps into per-app manifests)

  Keep cross-cutting dev tooling at root devDependencies if every app
  uses it (eslint, prettier, typescript-eslint). App-specific tooling
  (astro, oclif, fastify, prisma, vitest) belongs in the owning app.

  Commit:
      chore(monorepo): root package.json as workspace root
EOF
  exit 0
fi

# ─── A5: lockfile transition ─────────────────────────────────────────────
if [ ! -f pnpm-lock.yaml ] || [ -f package-lock.json ] || [ -f yarn.lock ]; then
  cat <<'EOF'
TASK: Switch to pnpm-lock.yaml as the sole lockfile (gate 5.A5).

      corepack enable
      pnpm install
      git add pnpm-lock.yaml
      git rm -f package-lock.json yarn.lock 2>/dev/null || true

  Verify:
    pnpm-lock.yaml exists
    package-lock.json / yarn.lock do NOT exist

  Commit:
      chore(monorepo): pnpm-lock.yaml, drop legacy lockfiles
EOF
  exit 0
fi

# ─── A6: install actually ran ────────────────────────────────────────────
if [ ! -d node_modules/.pnpm ]; then
  cat <<'EOF'
TASK: Run pnpm install (gate 5.A6).

      corepack enable
      pnpm install

  node_modules/.pnpm/ must exist after install — that is the proof pnpm
  populated node_modules (vs. an npm leftover).
EOF
  exit 0
fi

# ─── A3 + A4: app shells ─────────────────────────────────────────────────
A_MISS=()
for app in "${REQUIRED_APPS[@]}"; do
  pkg="apps/${app}/package.json"
  if [ ! -f "$pkg" ]; then
    A_MISS+=("$app (no $pkg)")
    continue
  fi
  name=$(node -e "try{console.log(require('./${pkg}').name||'')}catch(e){process.exit(1)}" 2>/dev/null)
  if [ "$name" != "@vooster/${app}" ]; then
    A_MISS+=("$app (name='${name}', want '@vooster/${app}')")
  fi
done
EXTRA_APPS=$(find apps -maxdepth 1 -mindepth 1 -type d 2>/dev/null \
              | awk -F/ '{print $NF}' \
              | grep -vE '^(api|cli|www)$' || true)
if [ "${#A_MISS[@]}" -gt 0 ] || [ -n "$EXTRA_APPS" ]; then
  cat <<EOF
TASK: Create the three app shells under apps/{api,cli,www} (gates 5.A3 / 5.A4).

EOF
  if [ "${#A_MISS[@]}" -gt 0 ]; then
    echo "  Missing or misnamed:"
    printf '    %s\n' "${A_MISS[@]}"
  fi
  if [ -n "$EXTRA_APPS" ]; then
    echo "  Unexpected app directories (delete or move):"
    echo "$EXTRA_APPS" | sed 's/^/    /'
  fi
  cat <<'EOF'

  For each of api, cli, www create:
      apps/<name>/package.json
      {
        "name": "@vooster/<name>",
        "version": "0.0.0",
        "private": true,
        "type": "module",
        "scripts": {
          "build":     "...",
          "test":      "...",
          "typecheck": "..."
        }
      }

  Don't move code yet — A3/A4 only require the shells. Tranche B is
  the relocation pass.

  Commit:
      chore(monorepo): app shells (api, cli, www)
EOF
  exit 0
fi

# ─── B1: legacy root dirs ────────────────────────────────────────────────
B1_LEFT=()
for d in "${LEGACY_ROOT_DIRS[@]}"; do
  [ -e "$d" ] && B1_LEFT+=("$d")
done
if [ "${#B1_LEFT[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Move legacy root directories into apps/ (gate 5.B1).

  Still at the repo root:
EOF
  printf '    %s\n' "${B1_LEFT[@]}"
  cat <<'EOF'

  Migration targets:
    src/{domain,ports,application,infrastructure,http}/ → apps/api/src/…
    src/cli/                                            → apps/cli/src/
    bin/run.js                                          → apps/cli/bin/run.js
    prisma/                                             → apps/api/prisma/
    tests/  (split per owner)                           → apps/api/tests/ , apps/cli/tests/

  Use git-aware moves so history follows:
      git mv src/domain     apps/api/src/domain
      git mv src/ports      apps/api/src/ports
      git mv src/application apps/api/src/application
      git mv src/infrastructure apps/api/src/infrastructure
      git mv src/http       apps/api/src/http
      git mv src/cli        apps/cli/src
      git mv bin            apps/cli/bin
      git mv prisma         apps/api/prisma
      # tests: move per ownership

  After each batch, update every goals/<n>-*.gates.sh AND every
  scripts/check-*.sh that hardcodes the old paths. Tranche D will fail
  loudly if you skip this — see step D1 hint.

  Commits (one per batch):
      chore(monorepo): move src/domain → apps/api/src/domain
      chore(monorepo): move src/cli   → apps/cli/src
      chore(monorepo): move prisma    → apps/api/prisma
      chore(monorepo): retarget prior gates at apps/ paths
EOF
  exit 0
fi

# ─── B2: API layers ──────────────────────────────────────────────────────
B2_MISS=()
for layer in "${REQUIRED_API_LAYERS[@]}"; do
  [ -d "apps/api/src/${layer}" ] || B2_MISS+=("$layer")
done
if [ "${#B2_MISS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Finish the API layer relocation (gate 5.B2).

  Missing under apps/api/src/:
EOF
  printf '    %s\n' "${B2_MISS[@]}"
  cat <<'EOF'

  Each must end up as a directory of the same name under apps/api/src/.
  The contents are unchanged from the pre-move tree.

  Commit:
      chore(monorepo): finish apps/api/src layer migration
EOF
  exit 0
fi

# ─── B3: prisma schema ──────────────────────────────────────────────────
if [ ! -f apps/api/prisma/schema.prisma ]; then
  cat <<'EOF'
TASK: Move the Prisma schema into apps/api (gate 5.B3).

      git mv prisma apps/api/prisma

  Update:
    - apps/api/package.json scripts (predev / prestart) to point at the
      new schema location, or remove them if Prisma's `schema.prisma`
      discovery finds it automatically.
    - docker-compose volume mounts that referenced ./prisma.
    - Any goals/<n>-*.gates.sh that greps prisma/schema.prisma at root.

  Commit:
      chore(monorepo): relocate prisma into apps/api
EOF
  exit 0
fi

# ─── B4: CLI wiring ──────────────────────────────────────────────────────
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
if [ "$B4_OK" = false ]; then
  cat <<'EOF'
TASK: Wire the CLI app (gate 5.B4).

  Required:
    apps/cli/src/         — CLI implementation (formerly src/cli/)
    apps/cli/bin/run.js   — oclif bin entry (formerly bin/run.js)
    apps/cli/package.json must declare:
        "bin": { "vspec": "./bin/run.js" }

  The CLI imports shared domain types from the API workspace:
        "dependencies": { "@vooster/api": "workspace:*" }
  (Spelling is up to you; pnpm install must resolve it.)

  Commit:
      chore(monorepo): wire apps/cli (src, bin, bin field)
EOF
  exit 0
fi

# ─── B6: required scripts ────────────────────────────────────────────────
B6_GAPS=()
for app in "${REQUIRED_APPS[@]}"; do
  pkg="apps/${app}/package.json"
  for s in "${REQUIRED_SCRIPTS[@]}"; do
    has=$(node -e "
      try {
        const p = require('./${pkg}');
        console.log(((p.scripts||{})['${s}']) ? 'y' : 'n');
      } catch(e) { process.exit(1); }
    " 2>/dev/null)
    [ "$has" = "y" ] || B6_GAPS+=("$app: missing '$s'")
  done
done
if [ "${#B6_GAPS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Declare build/test/typecheck scripts in every app (gate 5.B6).

  Missing:
EOF
  printf '    %s\n' "${B6_GAPS[@]}"
  cat <<'EOF'

  Suggested wiring:
    apps/api/package.json
      "build":     "tsc -b"
      "test":      "vitest run"
      "typecheck": "tsc --noEmit"

    apps/cli/package.json
      "build":     "tsc -b"
      "test":      "vitest run"
      "typecheck": "tsc --noEmit"

    apps/www/package.json
      "build":     "astro build"
      "test":      "astro check"
      "typecheck": "astro check"

  Commit:
      chore(monorepo): wire build/test/typecheck per app
EOF
  exit 0
fi

# ─── B7/B8: deep builds (only nag if not skipping) ───────────────────────
if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    if ! pnpm --filter @vooster/api build >/tmp/5-b7.log 2>&1; then
      cat <<'EOF'
TASK: Make the API build pass (gate 5.B7).

      pnpm --filter @vooster/api build

  See /tmp/5-b7.log for the error. Common causes after a move:
    - tsconfig paths still point at ../src/ instead of ./src/
    - imports use ../../domain/… style that no longer resolves
    - prisma generate needs to run after the schema move

  Commit:
      chore(monorepo): apps/api build green after relocation
EOF
      exit 0
    fi
    if ! pnpm --filter @vooster/cli build >/tmp/5-b8.log 2>&1; then
      cat <<'EOF'
TASK: Make the CLI build pass (gate 5.B8).

      pnpm --filter @vooster/cli build

  See /tmp/5-b8.log. Common causes:
    - @vooster/api workspace import path not resolving
    - oclif config still references old bin path

  Commit:
      chore(monorepo): apps/cli build green after relocation
EOF
      exit 0
    fi
  fi
fi

# ─── C1 + C2 + C3: Astro skeleton ────────────────────────────────────────
ASTRO_DEP_OK=false
if [ -f apps/www/package.json ]; then
  HAS=$(node -e "
    try {
      const p = require('./apps/www/package.json');
      const d = Object.assign({}, p.dependencies||{}, p.devDependencies||{});
      console.log(d.astro ? 'y' : 'n');
    } catch(e) { process.exit(1); }
  " 2>/dev/null)
  [ "$HAS" = "y" ] && ASTRO_DEP_OK=true
fi
HAS_CONFIG=false
{ [ -f apps/www/astro.config.mjs ] || [ -f apps/www/astro.config.ts ] || [ -f apps/www/astro.config.js ]; } && HAS_CONFIG=true
if ! $ASTRO_DEP_OK || ! $HAS_CONFIG || [ ! -f apps/www/src/pages/index.astro ]; then
  cat <<'EOF'
TASK: Scaffold the Astro app under apps/www (gates 5.C1 / 5.C2 / 5.C3).

      pnpm create astro@latest apps/www -- \
        --template minimal --typescript strict \
        --install --no-git --skip-houston

  After scaffolding, sanity-check:
    apps/www/package.json      has "astro" in (dev)Dependencies
    apps/www/astro.config.mjs  exists (or .ts/.js)
    apps/www/src/pages/index.astro exists

  Make sure apps/www/package.json keeps:
    "name":    "@vooster/www"
    "private": true
    "scripts": { "build": "astro build", ... } (per B6 above)

  Commit:
      feat(www): scaffold apps/www (astro minimal + typescript strict)
EOF
  exit 0
fi

# ─── C4: Korean text everywhere ──────────────────────────────────────────
check_korean_file() {
  node -e "
    try {
      const t = require('fs').readFileSync(process.argv[1], 'utf8');
      process.exit(/[가-힣]/.test(t) ? 0 : 1);
    } catch(e) { process.exit(2); }
  " "$1" >/dev/null 2>&1
}
C4_GAPS=()
check_korean_file apps/www/src/pages/index.astro \
  || C4_GAPS+=("apps/www/src/pages/index.astro")
while IFS= read -r f; do
  check_korean_file "$f" || C4_GAPS+=("$f")
done < <(find apps/www/src/components -name '*.astro' 2>/dev/null)
if [ "${#C4_GAPS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Write Korean copy in every landing file (gate 5.C4).

  These files contain no Hangul yet:
EOF
  printf '    %s\n' "${C4_GAPS[@]}"
  cat <<'EOF'

  English placeholders are not enough. Replace strings with real Korean
  copy. Quick check while editing:

      node -e "process.exit(/[가-힣]/.test(require('fs').readFileSync(process.argv[1],'utf8')) ? 0 : 1)" <file>

  Commit:
      feat(www): Korean copy for <area>
EOF
  exit 0
fi

# ─── C5: deep build for www ──────────────────────────────────────────────
if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ] && command -v pnpm >/dev/null 2>&1; then
  if ! pnpm --filter @vooster/www build >/tmp/5-c5.log 2>&1 \
      || [ ! -f apps/www/dist/index.html ]; then
    cat <<'EOF'
TASK: Make the Astro build pass (gate 5.C5).

      pnpm --filter @vooster/www build

  Verify apps/www/dist/index.html lands. See /tmp/5-c5.log for errors.

  Commit:
      feat(www): astro build green
EOF
    exit 0
  fi
fi

# ─── D1: prior-goal regression ───────────────────────────────────────────
D1_REGRESSED=()
for g in "${PRIOR_GOALS[@]}"; do
  bash "$ROOT/goals/${g}.gates.sh" >/dev/null 2>&1 || D1_REGRESSED+=("$g")
done
if [ "${#D1_REGRESSED[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Repair prior-goal gates after the monorepo move (gate 5.D1).

  Regressed:
EOF
  printf '    %s\n' "${D1_REGRESSED[@]}"
  cat <<'EOF'

  Each failing suite references paths that no longer exist at the repo
  root (src/, prisma/, bin/, tests/). For every red goal:

    1. Open goals/<n>-*.gates.sh
    2. Replace every `src/...` reference with `apps/api/src/...`
       (or `apps/cli/src/...` for CLI gates)
    3. Replace `prisma/schema.prisma` → `apps/api/prisma/schema.prisma`
    4. Replace `bin/run.js` → `apps/cli/bin/run.js`
    5. Replace `tests/e2e` / `tests/unit` / `tests/integration` with
       their new owner-app locations
    6. Also fix scripts/check-*.sh helpers that the gate sources
    7. Re-run: bash goals/<n>-*.gates.sh — must exit 0

  DO NOT loosen the assertion text. Path retargeting only. The
  check-gate-rigor meta-gate still requires enumeration.

  Commit per gate suite touched:
      chore(monorepo): retarget goal-<n> gates at apps/ paths
EOF
  exit 0
fi

# ─── D2: rigor on goal 5 ────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/5-monorepo.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-gate-rigor.sh green for goal 5 (gate 5.D2).

  The meta-gate flagged this goal's markdown as making "every X" claims
  while goals/5-monorepo.gates.sh has no iteration. Either:
    a) Add a for/while/find/xargs iteration that enumerates the claim's
       source of truth, or
    b) Tighten the goal text so it no longer claims universality.

  Do not silence the check.
EOF
  exit 0
fi

# ─── All cheap gates clear: encourage a full deep run ────────────────────
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  cat <<'EOF'
TASK: All cheap sub-gates appear green. Drop the deep-skip flag and run a
      full verification before declaring goal 5 done:

          unset VSPEC_GATES_SKIP_DEEP
          bash scripts/completion-check.sh
EOF
  exit 0
fi

cat <<'EOF'
TASK: All sub-gates of goal 5 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/6-*.md or stop.
EOF
