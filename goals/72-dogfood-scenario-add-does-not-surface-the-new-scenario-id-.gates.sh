#!/usr/bin/env bash
# goals/72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-.gates.sh
# Every scenario type that `vspec scenario add` can create surfaces the new
# scenario's real id in a `vspec step add <id> …` suggested_next_action on the
# CREATED 201 path -- never a `<…>` placeholder. The success-path content is
# locked by the unit suite, and the create response still typechecks.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-"
TYPES_SRC="packages/contracts/src/scenario.ts"
ANCHOR="MAIN_SUCCESS"
GATE_INPUTS=(
  apps/api/src
  apps/api/tests/unit/http/scenario-results.test.ts
  packages/contracts/src/scenario.ts
  goals/72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-.md
  goals/72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[72.A1] API typecheck (suggested_next_actions carried through scenarioCreateResponseSchema)"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[72.A2] scenario-results behaviour suite passes (templated next action, happy path unchanged)"
if pnpm exec vitest run apps/api/tests/unit/http/scenario-results.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[72.B1] every scenario type surfaces the real scenario id in a \`vspec step add\` next action on create"
# Universal claim -> enumerate the scenario-type enum from the contracts source of
# truth and loop the real sendCreateScenarioResult over each type. No single-case
# cheat: the asserted command must carry the exact sentinel id and no placeholder.
if [ ! -f "$TYPES_SRC" ]; then
  echo "    fail -- $TYPES_SRC is missing; it is the source of truth for the scenario-type enum"
  PASS=false
else
  TYPES_FILE="$(mktemp)"
  # Extract the quoted members of `scenarioTypeSchema = z.enum([...])`.
  grep -E 'scenarioTypeSchema[[:space:]]*=[[:space:]]*z\.enum' "$TYPES_SRC" \
    | grep -oE '"[A-Z_]+"' \
    | tr -d '"' \
    | sort -u \
    > "$TYPES_FILE"

  TYPE_COUNT=$(grep -c . "$TYPES_FILE" || true)
  echo "    enumerated $TYPE_COUNT scenario type(s) from $TYPES_SRC"

  if ! grep -qxF "$ANCHOR" "$TYPES_FILE"; then
    echo "    fail -- the scenario-type enum is missing the dogfood anchor type: \"$ANCHOR\""
    PASS=false
  fi

  if [ "$TYPE_COUNT" -lt 2 ]; then
    echo "    fail -- the scenario-type enum declares $TYPE_COUNT type(s); >= 2 is required"
    PASS=false
  fi

  # The harness imports the real sendCreateScenarioResult, drives it over a
  # CREATED result whose scenario.id is a known sentinel, captures the sent body,
  # and asserts a `vspec step add` next action carries that exact id with no
  # `<…>` placeholder.
  HARNESS='
import { sendCreateScenarioResult } from "./src/http/scenario-results.ts";
const type = process.argv[1];
const realId = process.argv[2];
let body;
const reply = {
  code() { return reply; },
  send(b) { body = b; return b; }
};
try {
  sendCreateScenarioResult(reply, {
    status: "CREATED",
    revision: {},
    scenario: { id: realId, usecase_id: "usecase-1", type, outcome: "SUCCESS" },
    steps: []
  });
} catch (e) {
  console.log("FAIL THREW " + String(e));
  process.exit(0);
}
const actions = (body && body.suggested_next_actions) || [];
const stepAdd = actions.find(
  (a) => a && typeof a.command === "string" && a.command.includes("vspec step add")
);
if (!stepAdd) {
  console.log("FAIL NO_STEP_ADD_NEXT_ACTION " + JSON.stringify(actions));
} else if (stepAdd.command.includes("<")) {
  console.log("FAIL PLACEHOLDER " + stepAdd.command);
} else if (!stepAdd.command.includes(realId)) {
  console.log("FAIL NO_REAL_ID " + stepAdd.command);
} else {
  console.log("PASS " + stepAdd.command);
}
'

  while IFS= read -r TYPE; do
    [ -z "$TYPE" ] && continue
    SENTINEL="scn-${TYPE}-real-id-7f3a91"
    OUT="$(pnpm --filter @vooster/api exec tsx -e "$HARNESS" "$TYPE" "$SENTINEL" 2>&1 || true)"
    VERDICT="$(printf '%s\n' "$OUT" | grep -E '^(PASS|FAIL) ' | tail -n 1)"
    if printf '%s' "$VERDICT" | grep -q '^PASS '; then
      echo "    pass -- \`scenario add\` (type $TYPE) surfaces the real id: ${VERDICT#PASS }"
    else
      echo "    fail -- \`scenario add\` (type $TYPE) did not surface the real scenario id in a \`vspec step add\` next action:"
      printf '%s\n' "${VERDICT:-$OUT}" | sed 's/^/        /'
      PASS=false
    fi
  done < "$TYPES_FILE"

  rm -f "$TYPES_FILE"
fi

echo "[72.C1 Gate rigor]"
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
