#!/usr/bin/env bash
# goals/74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro.gates.sh
# Every failure scenario in the verify error-surface corpus (no-key + unresolved
# key) translates into a structured envelope (stable `code`) and never leaks a
# raw `ApiError:` class string or a bare `Error:`; a missing/unresolved key is
# self-teaching (locked by the unit suite); the happy path stays green.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro"
CORPUS="apps/cli/tests/fixtures/usecase-verify-error-surface.txt"
ANCHOR="__NONE__"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests/unit/usecase-verify-error-surface.test.ts
  apps/cli/tests/fixtures/usecase-verify-error-surface.txt
  goals/74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro.md
  goals/74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[74.A1] CLI typecheck"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[74.A2] verify error-surface behaviour suite passes (self-teaching missing/unresolved-key envelope, happy path unchanged)"
if pnpm exec vitest run apps/cli/tests/unit/usecase-verify-error-surface.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[74.B1] every verify error-surface scenario emits a structured envelope and never leaks a raw ApiError / bare Error string"
# Universal claim -> enumerate the corpus from source of truth and loop the real
# runVerify over each scenario against a stubbed 404. No single-case cheat.
if [ ! -f "$CORPUS" ]; then
  echo "    fail -- corpus $CORPUS is missing; it is the source of truth and must exist"
  PASS=false
else
  SCEN_FILE="$(mktemp)"
  # Strip blank lines and `#` comments; keep scenarios verbatim (trailing ws trimmed).
  sed -E 's/[[:space:]]+$//' "$CORPUS" \
    | grep -vE '^[[:space:]]*(#|$)' \
    > "$SCEN_FILE"

  SCEN_COUNT=$(grep -c . "$SCEN_FILE" || true)
  echo "    enumerated $SCEN_COUNT corpus scenario(s) from $CORPUS"

  if ! grep -qxF "$ANCHOR" "$SCEN_FILE"; then
    echo "    fail -- corpus is missing the dogfood regression anchor scenario: \"$ANCHOR\" (the no-key case)"
    PASS=false
  fi

  if [ "$SCEN_COUNT" -lt 2 ]; then
    echo "    fail -- corpus has $SCEN_COUNT scenario(s); a representative spread (>= 2, covering no-key + unresolved-key) is required"
    PASS=false
  fi

  # The harness imports the real runVerify, stubs global fetch to return a 404
  # Problem Details body, runs the given scenario in --format agent, and prints
  # whatever reached the writeLine sink (or the stringified error if it threw).
  # The __NONE__ sentinel means: invoke with NO use case key.
  HARNESS='
import { runVerify } from "./src/commands/verify.ts";
const token = process.argv[1];
const usecaseKey = token === "__NONE__" ? undefined : token;
globalThis.fetch = async () =>
  new Response(JSON.stringify({ title: "Use case not found", status: 404 }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
const lines = [];
void (async () => {
  try {
    await runVerify(
      {
        "api-url": "https://api.test",
        "session-cookie": "session-token",
        format: "agent"
      },
      usecaseKey,
      (m) => lines.push(m)
    );
  } catch (e) {
    lines.push(String(e));
  }
  console.log(lines.join("\n"));
})();
'

  while IFS= read -r SCEN; do
    [ -z "$SCEN" ] && continue
    OUT="$(pnpm --filter @vooster/cli exec tsx -e "$HARNESS" "$SCEN" 2>&1 || true)"
    if printf '%s' "$OUT" | grep -q 'ApiError'; then
      echo "    fail -- \`vspec usecase verify\` scenario [$SCEN] leaks a raw ApiError class string on an API failure:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif printf '%s' "$OUT" | grep -qE '^Error: '; then
      echo "    fail -- \`vspec usecase verify\` scenario [$SCEN] leaks a bare Error string instead of a structured envelope:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif ! printf '%s' "$OUT" | grep -q '"code"'; then
      echo "    fail -- \`vspec usecase verify\` scenario [$SCEN] did not emit a structured envelope with a stable \"code\" on an API failure:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    else
      echo "    pass -- scenario [$SCEN] emits a structured envelope, no raw ApiError / bare Error"
    fi
  done < "$SCEN_FILE"

  rm -f "$SCEN_FILE"
fi

echo "[74.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
