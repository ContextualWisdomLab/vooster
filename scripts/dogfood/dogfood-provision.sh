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

echo "=== dogfood provision (link=$VSPEC_DOGFOOD_LINK, per-case baselines) ==="

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

# ── 0.3 verify per-case baseline refs exist ──────────────────────────────────
# The repo is reset PER CASE in dogfood-run.sh (cases declare different
# baselines), so here we only confirm the refs the selected cases need exist.
echo "[0.3] verify baseline refs"
if df_dry_run; then
  echo "  [dry-run] cases reset to git ref baseline/<case.baseline> at run time"
else
  for b in $(for c in $(select_cases); do case_field "$(case_file "$c")" baseline; done | sort -u); do
    [ -n "$b" ] || continue
    if git -C "$VSPEC_DOGFOOD_REPO" rev-parse --verify -q "baseline/$b" >/dev/null \
       || git -C "$VSPEC_DOGFOOD_REPO" rev-parse --verify -q "$b" >/dev/null; then
      echo "  ✓ baseline '$b'"
    else
      df_die "missing baseline ref for '$b' (expected git ref 'baseline/$b' in the dogfood repo — see scripts/dogfood/dogfood-init-repo.sh)"
    fi
  done
fi

# ── 0.4 link the local build GLOBALLY ─────────────────────────────────────────
# Install on PATH globally, not into the repo's node_modules — so per-case
# `git clean` in dogfood-run.sh cannot wipe the CLI under test.
echo "[0.4] link local build ($VSPEC_DOGFOOD_LINK, global)"
if df_dry_run; then
  echo "  [dry-run] would install local @vooster/cli globally via $VSPEC_DOGFOOD_LINK"
else
  case "$VSPEC_DOGFOOD_LINK" in
    pack)
      df_require_cmd pnpm
      df_require_cmd npm
      pack_dir="$(mktemp -d "${TMPDIR:-/tmp}/vspec-dogfood-pack.XXXXXX")" || df_die "could not create pack temp dir"
      if ! pnpm --dir "$ROOT/packages/contracts" pack --pack-destination "$pack_dir" --silent >/dev/null; then
        rm -rf "$pack_dir"
        df_die "pnpm pack for @vooster/contracts failed"
      fi
      if ! pnpm --dir "$ROOT/apps/cli" pack --pack-destination "$pack_dir" --silent >/dev/null; then
        rm -rf "$pack_dir"
        df_die "pnpm pack for @vooster/cli failed"
      fi
      contracts_tarball="$(find "$pack_dir" -maxdepth 1 -name 'vooster-contracts-*.tgz' -print -quit)"
      cli_tarball="$(find "$pack_dir" -maxdepth 1 -name 'vooster-cli-*.tgz' -print -quit)"
      [ -n "$contracts_tarball" ] && [ -f "$contracts_tarball" ] || { rm -rf "$pack_dir"; df_die "contracts pack produced no tarball"; }
      [ -n "$cli_tarball" ] && [ -f "$cli_tarball" ] || { rm -rf "$pack_dir"; df_die "CLI pack produced no tarball"; }
      npm install -g "$contracts_tarball" "$cli_tarball" || { rm -rf "$pack_dir"; df_die "global install of packed CLI failed"; }
      rm -rf "$pack_dir"
      ;;
    link)
      df_require_cmd pnpm
      ( cd "$ROOT/apps/cli" && pnpm link --global ) || df_die "pnpm link --global failed"
      ;;
    *) df_die "unknown VSPEC_DOGFOOD_LINK='$VSPEC_DOGFOOD_LINK' (expected pack|link)" ;;
  esac
  command -v vspec >/dev/null 2>&1 || echo "  ⚠ 'vspec' not on PATH after install — check global bin dir"
fi

# ── 0.5 running API + seeded auth ────────────────────────────────────────────
# vspec is a SaaS: the CLI needs a reachable API and an authenticated context.
# Headless OAuth device flow is impossible, so a hook must boot the API and
# seed a session/API key. If no API is available this is itself a finding —
# but we cannot run the cases without it, so a real run requires it.
echo "[0.5] API + auth"
if df_dry_run; then
  echo "  [dry-run] would seed auth (hook='${VSPEC_DOGFOOD_PROVISION_HOOK:-none}', api='${VSPEC_DOGFOOD_API_URL:-unset}')"
elif [ -n "$VSPEC_DOGFOOD_PROVISION_HOOK" ]; then
  # Custom hook owns booting the API and seeding auth.
  [ -x "$VSPEC_DOGFOOD_PROVISION_HOOK" ] || df_die "VSPEC_DOGFOOD_PROVISION_HOOK is not executable"
  "$VSPEC_DOGFOOD_PROVISION_HOOK" || df_die "provision hook failed"
elif [ -n "$VSPEC_DOGFOOD_API_URL" ] && [ -n "$VSPEC_DOGFOOD_SESSION_COOKIE" ]; then
  # Caller supplied a session token directly — write the config the CLI reads.
  mkdir -p "$VSPEC_DOGFOOD_REPO/.vspec"
  tok="${VSPEC_DOGFOOD_SESSION_COOKIE#vspec_session=}"
  df_require_cmd jq
  jq -n --arg api "${VSPEC_DOGFOOD_API_URL%/}" --arg tok "$tok" \
    '{api_url:$api, session_token:$tok}' > "$VSPEC_DOGFOOD_REPO/.vspec/config.json"
  echo "  ✓ wrote .vspec/config.json pointing at $VSPEC_DOGFOOD_API_URL"
elif [ -n "$VSPEC_DOGFOOD_API_URL" ]; then
  # Ensure a stub-enabled API is up (idempotent; boots local in-memory API for
  # localhost URLs), then mint a session headlessly via the stub.
  # --restart so the freshly built code (step 0.1) is what serves, not a stale
  # instance left running from a previous cycle.
  case "$VSPEC_DOGFOOD_API_URL" in
    *localhost*|*127.0.0.1*) bash "$ROOT/scripts/dogfood/dogfood-serve-api.sh" --restart || df_die "could not start local API" ;;
  esac
  bash "$ROOT/scripts/dogfood/dogfood-seed-auth.sh" || df_die "auth seeding failed"
else
  df_die "no API/auth: set VSPEC_DOGFOOD_API_URL (stub-enabled API), or VSPEC_DOGFOOD_PROVISION_HOOK, or VSPEC_DOGFOOD_API_URL + VSPEC_DOGFOOD_SESSION_COOKIE"
fi

echo "✓ provision complete"
