#!/usr/bin/env bash
# scripts/dogfood/dogfood-init-repo.sh — Scaffold the separate dogfood repo.
#
# The dogfood loop runs ICP cases inside a git repo that lives OUTSIDE this
# monorepo (docs/dogfood-loop.md § "dogfood 코드베이스"). Each case declares a
# `baseline:` that maps to a git ref `baseline/<name>`; provision verifies those
# refs and dogfood-run.sh resets to them per case. This script creates that repo
# with the baseline branches the initial case set needs:
#
#   baseline/empty         pristine — only a thin CLAUDE.md (greenfield, cold-start)
#   baseline/seeded-small  a project with a few existing specs (add/refine cases)
#   baseline/seeded-rough  specs with intentional quality issues (doctor case)
#
# The seeded-* branches start as documented placeholders: populate them by
# running vspec once against a running API and committing the result, so the
# baselines reflect the REAL on-disk spec format rather than a guess.
#
# Usage:  bash scripts/dogfood/dogfood-init-repo.sh <target-dir> [--force]
# Exit:   0 ok · 1 hard error.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

TARGET="${1:?usage: dogfood-init-repo.sh <target-dir> [--force]}"
FORCE="${2:-}"

die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# Refuse to scaffold inside the monorepo.
case "$(cd "$(dirname "$TARGET")" 2>/dev/null && pwd)/$(basename "$TARGET")/" in
  "$ROOT"/*) die "target must be OUTSIDE this monorepo ($ROOT)";;
esac

if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ] && [ "$FORCE" != "--force" ]; then
  die "target '$TARGET' exists and is not empty (pass --force to proceed)"
fi

command -v git >/dev/null 2>&1 || die "git not on PATH"

mkdir -p "$TARGET"
cd "$TARGET"
git init -q
git symbolic-ref HEAD refs/heads/baseline/empty 2>/dev/null || git checkout -q -b baseline/empty

# ── baseline/empty ───────────────────────────────────────────────────────────
cat > CLAUDE.md <<'EOF'
# Project notes

This repository uses **vspec** to manage software specifications. `vspec` is on
your PATH. Use it as your spec tool. There is intentionally no further usage
documentation here — discover the workflow from the tool itself.
EOF
cat > .gitignore <<'EOF'
node_modules/
.vspec/cache/
.vspec/session.json
.vspec/sync-state.json
EOF
git add -A
git -c user.email=dogfood@vspec.local -c user.name=dogfood commit -qm "baseline/empty: thin CLAUDE.md only"

# ── baseline/seeded-small ────────────────────────────────────────────────────
git checkout -q -b baseline/seeded-small
mkdir -p specs
cat > specs/SEED_NOTES.md <<'EOF'
# seeded-small baseline (placeholder)

This branch should hold a small, healthy vspec project: one bound project, a
couple of well-formed use cases, and their actors — produced by running vspec
against a real API. Populate it once, then `git commit --amend` (or recommit)
on this branch so DF-002/DF-003/DF-004 start from real synced specs.

Until populated, these cases will run against near-empty state.
EOF
git add -A
git -c user.email=dogfood@vspec.local -c user.name=dogfood commit -qm "baseline/seeded-small: placeholder (populate via vspec)"

# ── baseline/seeded-rough ────────────────────────────────────────────────────
git checkout -q baseline/empty
git checkout -q -b baseline/seeded-rough
mkdir -p specs
cat > specs/SEED_NOTES.md <<'EOF'
# seeded-rough baseline (placeholder)

This branch should hold a project whose specs have INTENTIONAL quality issues
for DF-005 (doctor → fix): e.g. a use case missing a main success scenario, a
too-terse step, an actor with no description, and — importantly — at least one
Korean / concise-but-fine spec to probe doctor's language-awareness (a good
doctor must NOT flag it). Populate via vspec, then recommit on this branch.
EOF
git add -A
git -c user.email=dogfood@vspec.local -c user.name=dogfood commit -qm "baseline/seeded-rough: placeholder (populate via vspec)"

git checkout -q baseline/empty

echo "✓ dogfood repo scaffolded at $TARGET"
echo "  branches: baseline/empty, baseline/seeded-small, baseline/seeded-rough"
echo
echo "Next:"
echo "  export VSPEC_DOGFOOD_REPO=\"$(cd "$TARGET" && pwd)\""
echo "  # populate seeded-* baselines by running vspec there and recommitting"
echo "  # then provide API + auth (VSPEC_DOGFOOD_API_URL + VSPEC_DOGFOOD_SESSION_COOKIE"
echo "  #   or VSPEC_DOGFOOD_PROVISION_HOOK), and run scripts/dogfood/dogfood-cycle.sh"
