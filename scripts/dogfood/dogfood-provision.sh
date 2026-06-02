#!/usr/bin/env bash
# scripts/dogfood/dogfood-provision.sh — Step 0 of a dogfood cycle.
#
# Make the separate dogfood repo a pristine, instrumented playground for an
# ICP agent: build the LOCAL vspec, reset the repo to a clean baseline, link
# the local build in, and ensure the CLI has a running API + seeded auth to
# talk to. Design + rationale: docs/dogfood-loop.md § "dogfood 코드베이스".
#
# Usage:  bash scripts/dogfood/dogfood-provision.sh [<baseline-ref>]
# Env:    see _dogfood-lib.sh (VSPEC_DOGFOOD_REPO required for real runs).
# Exit:   0 ok · 1 hard error.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

BASELINE="${1:-$VSPEC_DOGFOOD_BASELINE}"

echo "=== dogfood provision (baseline=$BASELINE, link=$VSPEC_DOGFOOD_LINK) ==="

# ── 0.1 build the local product ──────────────────────────────────────────────
echo "[0.1] build local vspec"
if df_dry_run; then
  echo "  [dry-run] would: pnpm -r --filter @vooster/cli --filter @vooster/api build"
else
  df_require_cmd pnpm
  pnpm -r --filter @vooster/cli --filter @vooster/api build || df_die "local build failed"
fi

# ── 0.2 validate the dogfood repo ────────────────────────────────────────────
echo "[0.2] validate dogfood repo"
if df_dry_run && [ -z "$VSPEC_DOGFOOD_REPO" ]; then
  echo "  [dry-run] VSPEC_DOGFOOD_REPO unset — skipping repo validation"
else
  [ -n "$VSPEC_DOGFOOD_REPO" ] || df_die "VSPEC_DOGFOOD_REPO is required (path to the separate dogfood git repo)"
  [ -d "$VSPEC_DOGFOOD_REPO/.git" ] || df_die "VSPEC_DOGFOOD_REPO ('$VSPEC_DOGFOOD_REPO') is not a git repo"
  case "$(cd "$VSPEC_DOGFOOD_REPO" && pwd)/" in
    "$ROOT"/*) df_die "dogfood repo must live OUTSIDE this monorepo (got '$VSPEC_DOGFOOD_REPO')" ;;
  esac
fi

# ── 0.3 clean reset to baseline ──────────────────────────────────────────────
echo "[0.3] reset repo to pristine baseline"
if df_dry_run; then
  echo "  [dry-run] would: git -C \$REPO clean -fdx && git -C \$REPO reset --hard $BASELINE"
else
  git -C "$VSPEC_DOGFOOD_REPO" clean -fdx >/dev/null 2>&1 || df_die "git clean failed"
  git -C "$VSPEC_DOGFOOD_REPO" reset --hard "$BASELINE" >/dev/null 2>&1 \
    || df_die "git reset --hard $BASELINE failed (does the ref exist?)"
fi

# ── 0.4 link the local build into the repo ───────────────────────────────────
echo "[0.4] link local build ($VSPEC_DOGFOOD_LINK)"
if df_dry_run; then
  echo "  [dry-run] would install local @vooster/cli into the dogfood repo via $VSPEC_DOGFOOD_LINK"
else
  case "$VSPEC_DOGFOOD_LINK" in
    pack)
      df_require_cmd npm
      tarball="$(cd "$ROOT/apps/cli" && npm pack --silent 2>/dev/null | tail -1)"
      [ -n "$tarball" ] && [ -f "$ROOT/apps/cli/$tarball" ] || df_die "npm pack produced no tarball"
      ( cd "$VSPEC_DOGFOOD_REPO" && npm install --no-save "$ROOT/apps/cli/$tarball" ) \
        || df_die "installing packed CLI into dogfood repo failed"
      rm -f "$ROOT/apps/cli/$tarball"
      ;;
    link)
      df_require_cmd pnpm
      ( cd "$ROOT/apps/cli" && pnpm link --global ) || df_die "pnpm link --global failed"
      ( cd "$VSPEC_DOGFOOD_REPO" && pnpm link --global @vooster/cli ) || df_die "pnpm link into repo failed"
      ;;
    *) df_die "unknown VSPEC_DOGFOOD_LINK='$VSPEC_DOGFOOD_LINK' (expected pack|link)" ;;
  esac
fi

# ── 0.5 running API + seeded auth ────────────────────────────────────────────
# vspec is a SaaS: the CLI needs a reachable API and an authenticated context.
# Headless OAuth device flow is impossible, so a hook must boot the API and
# seed a session/API key. If no API is available this is itself a finding —
# but we cannot run the cases without it, so a real run requires it.
echo "[0.5] API + auth"
if df_dry_run; then
  echo "  [dry-run] would boot API + seed auth (hook='${VSPEC_DOGFOOD_PROVISION_HOOK:-none}', api='${VSPEC_DOGFOOD_API_URL:-unset}')"
elif [ -n "$VSPEC_DOGFOOD_PROVISION_HOOK" ]; then
  [ -x "$VSPEC_DOGFOOD_PROVISION_HOOK" ] || df_die "VSPEC_DOGFOOD_PROVISION_HOOK is not executable"
  VSPEC_DOGFOOD_REPO="$VSPEC_DOGFOOD_REPO" "$VSPEC_DOGFOOD_PROVISION_HOOK" \
    || df_die "provision hook failed"
elif [ -n "$VSPEC_DOGFOOD_API_URL" ] && [ -n "$VSPEC_DOGFOOD_SESSION_COOKIE" ]; then
  # Minimal default: write a thin .vspec config the CLI can read.
  mkdir -p "$VSPEC_DOGFOOD_REPO/.vspec"
  cat > "$VSPEC_DOGFOOD_REPO/.vspec/session.json" <<EOF
{ "api_url": "$VSPEC_DOGFOOD_API_URL", "session_cookie": "$VSPEC_DOGFOOD_SESSION_COOKIE" }
EOF
  echo "  ✓ seeded .vspec/session.json pointing at $VSPEC_DOGFOOD_API_URL"
else
  df_die "no API/auth: set VSPEC_DOGFOOD_PROVISION_HOOK, or both VSPEC_DOGFOOD_API_URL and VSPEC_DOGFOOD_SESSION_COOKIE"
fi

echo "✓ provision complete"
