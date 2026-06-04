#!/usr/bin/env bash
# scripts/dogfood/dogfood-seed-auth.sh — Mint a vspec session headlessly.
#
# Headless GitHub OAuth device flow is impossible, so we use the API's built-in
# auth STUB (enabled when the API runs with VSPEC_AUTH_STUB=1). The stub treats
# the OAuth `code` as the GitHub identity (apps/api/src/http/signup-support.ts:
# `githubId: code`), so a unique code signs up a fresh user and returns a
# `vspec_session` cookie. We write it into the dogfood repo's
# .vspec/global-config.json (api_url + session_token) — the isolated global
# config path the dogfood wrapper forces the CLI to read.
#
# This is the default value for VSPEC_DOGFOOD_PROVISION_HOOK. It assumes the API
# is ALREADY running at $VSPEC_DOGFOOD_API_URL with the stub enabled.
#
# Usage:  bash scripts/dogfood/dogfood-seed-auth.sh
# Env:    VSPEC_DOGFOOD_API_URL (required), VSPEC_DOGFOOD_REPO (required)
# Exit:   0 ok · 1 hard error.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

[ -n "$VSPEC_DOGFOOD_API_URL" ] || df_die "VSPEC_DOGFOOD_API_URL is required to seed auth"
[ -n "$VSPEC_DOGFOOD_REPO" ]    || df_die "VSPEC_DOGFOOD_REPO is required to write seeded config"
df_require_cmd curl
df_require_cmd jq

API="${VSPEC_DOGFOOD_API_URL%/}"
# Keep the seeded account aligned with any agent-triggered
# `VSPEC_AUTH_STUB=1 vspec login`; otherwise a login probe silently switches
# the agent into a different stub workspace.
CODE="$VSPEC_DOGFOOD_AUTH_STUB_ID"
slug="$(printf 'dogfood-%s' "$CODE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed -e 's/^-//' -e 's/-$//' | cut -c1-63)"

hdr_start="$(mktemp)"; body_start="$(mktemp)"
hdr_cb="$(mktemp)"; body_cb="$(mktemp)"
trap 'rm -f "$hdr_start" "$body_start" "$hdr_cb" "$body_cb"' EXIT

echo "=== seed auth via stub at $API ==="

# 1. start OAuth (signup) — returns {authorization_url,state} + vspec_oauth_state cookie
curl -sS -D "$hdr_start" -o "$body_start" \
  -X POST "$API/v1/auth/github/start" \
  -H "Content-Type: application/json" \
  -d "{\"workspace\":{\"name\":\"Dogfood $CODE\",\"slug\":\"$slug\"}}" \
  || df_die "auth start request failed (is the API up at $API?)"

state="$(jq -r '.state // empty' "$body_start")"
[ -n "$state" ] || df_die "auth start returned no state (is VSPEC_AUTH_STUB=1 on the API?): $(cat "$body_start")"
oauth_cookie="$(grep -i '^set-cookie:' "$hdr_start" | grep -o 'vspec_oauth_state=[^;]*' | head -1)"
[ -n "$oauth_cookie" ] || df_die "auth start set no vspec_oauth_state cookie"

# 2. complete OAuth callback with the stub code — sets vspec_session cookie
curl -sS -D "$hdr_cb" -o "$body_cb" \
  -H "Cookie: $oauth_cookie" \
  "$API/v1/auth/github/callback?code=$CODE&state=$state" \
  || df_die "auth callback request failed"

token="$(grep -i '^set-cookie:' "$hdr_cb" | grep -o 'vspec_session=[^;]*' | head -1)"
token="${token#vspec_session=}"
[ -n "$token" ] || df_die "callback did not set a vspec_session cookie (auth seed failed)"
workspace_id="$(jq -r '.workspace.id // empty' "$body_cb" 2>/dev/null)"
workspace_slug="$(jq -r '.workspace.slug // empty' "$body_cb" 2>/dev/null)"

# 3. write the isolated global config the CLI reads during dogfood sessions
config_path="${VSPEC_DOGFOOD_GLOBAL_CONFIG:-$VSPEC_DOGFOOD_REPO/.vspec/global-config.json}"
mkdir -p "$(dirname "$config_path")"
jq -n \
  --arg api "$API" \
  --arg tok "$token" \
  --arg workspace_id "$workspace_id" \
  --arg workspace_slug "$workspace_slug" \
  '{
    api_url: $api,
    session_token: $tok
  }
  + (if $workspace_id == "" then {} else {current_workspace_id: $workspace_id} end)
  + (if $workspace_slug == "" then {} else {current_workspace_slug: $workspace_slug} end)' \
  > "$config_path"

echo "✓ seeded $config_path (api_url=$API, session for $CODE)"
