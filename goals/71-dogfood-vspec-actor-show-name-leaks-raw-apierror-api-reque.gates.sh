#!/usr/bin/env bash
# goals/71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque.gates.sh
# Every `vspec actor` command in the error-surface corpus translates an API
# failure into a structured envelope (stable `code`) and never leaks a raw
# `ApiError:` class string, an unresolved actor is self-teaching (locked by the
# unit suite), and the happy paths stay green.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque"
CORPUS="apps/cli/tests/fixtures/actor-error-surface-commands.txt"
ANCHOR="show"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests/unit/actor-command.test.ts
  apps/cli/tests/fixtures/actor-error-surface-commands.txt
  goals/71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque.md
  goals/71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[71.A1] CLI typecheck"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[71.A2] actor-command behaviour suite passes (self-teaching unresolved-actor envelope, happy paths unchanged)"
if pnpm exec vitest run apps/cli/tests/unit/actor-command.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[71.B1] every actor command in the error-surface corpus emits a structured envelope and never leaks a raw ApiError class string"
# Universal claim -> enumerate the corpus from source of truth and loop the real
# runActor over each command against a stubbed 404. No single-case cheat.
if [ ! -f "$CORPUS" ]; then
  echo "    fail -- corpus $CORPUS is missing; it is the source of truth and must exist"
  PASS=false
else
  CMDS_FILE="$(mktemp)"
  # Strip blank lines and `#` comments; keep commands verbatim (trimmed).
  sed -E 's/[[:space:]]+$//' "$CORPUS" \
    | grep -vE '^[[:space:]]*(#|$)' \
    > "$CMDS_FILE"

  CMD_COUNT=$(grep -c . "$CMDS_FILE" || true)
  echo "    enumerated $CMD_COUNT corpus command(s) from $CORPUS"

  if ! grep -qxF "$ANCHOR" "$CMDS_FILE"; then
    echo "    fail -- corpus is missing the dogfood regression anchor command: \"$ANCHOR\""
    PASS=false
  fi

  if [ "$CMD_COUNT" -lt 3 ]; then
    echo "    fail -- corpus has $CMD_COUNT command(s); a representative spread (>= 3) of actor commands is required"
    PASS=false
  fi

  # The harness imports the real runActor, stubs global fetch to return a 404
  # Problem Details body, runs the given sub-action in --format agent, and prints
  # whatever reached the writeLine sink (or the stringified error if it threw).
  HARNESS='
import { runActor } from "./src/commands/actor.ts";
const sub = process.argv[1];
const lookup = process.argv[2];
globalThis.fetch = async () =>
  new Response(JSON.stringify({ title: "Actor not found", status: 404 }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
const lines = [];
void (async () => {
  try {
    await runActor(
      {
        "api-url": "https://api.test",
        "project-id": "project-1",
        "session-cookie": "session-token",
        format: "agent",
        name: "Probe",
        type: "PRIMARY"
      },
      sub,
      lookup,
      (m) => lines.push(m)
    );
  } catch (e) {
    lines.push(String(e));
  }
  console.log(lines.join("\n"));
})();
'

  while IFS= read -r SUB; do
    [ -z "$SUB" ] && continue
    OUT="$(pnpm --filter @vooster/cli exec tsx -e "$HARNESS" "$SUB" "Account Holder" 2>&1 || true)"
    if printf '%s' "$OUT" | grep -q 'ApiError'; then
      echo "    fail -- \`vspec actor $SUB\` leaks a raw ApiError class string on an API failure:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif ! printf '%s' "$OUT" | grep -q '"code"'; then
      echo "    fail -- \`vspec actor $SUB\` did not emit a structured envelope with a stable \"code\" on an API failure:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    else
      echo "    pass -- \`vspec actor $SUB\` emits a structured envelope, no raw ApiError"
    fi
  done < "$CMDS_FILE"

  rm -f "$CMDS_FILE"
fi

echo "[71.C1 Gate rigor]"
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
