#!/usr/bin/env bash
# goals/75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l.gates.sh
# Every not-found route in the recovery-surface corpus teaches the real recovery
# (`vspec usecase show`) and never inherits the signup `vspec login` /
# "Restart signup" default; the shared problem() helper no longer ships that
# default (negative universal invariant); entity NOT_FOUND responses are
# self-teaching while auth recoveries are preserved (locked by the unit suite).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l"
CORPUS="apps/api/tests/fixtures/not-found-recovery-surface.txt"
SUITE="apps/api/tests/unit/http/not-found-recovery.test.ts"
HELPER="apps/api/src/http/signup-support.ts"
ANCHOR="step-add-scenario-not-found"
GATE_INPUTS=(
  apps/api/src/http
  apps/api/tests/unit/http/not-found-recovery.test.ts
  apps/api/tests/fixtures/not-found-recovery-surface.txt
  goals/75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l.md
  goals/75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[75.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[75.A2] not-found recovery behaviour suite passes (entity NOT_FOUND self-teaching; auth recoveries preserved)"
if pnpm exec vitest run "$SUITE"; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[75.B1] every not-found route in the corpus teaches \`vspec usecase show\` and never leaks the signup recovery"
# Universal claim -> enumerate the corpus from the source of truth and loop the
# REAL result-sender for each token, capturing the body it would send. No
# single-case cheat.
if [ ! -f "$CORPUS" ]; then
  echo "    fail -- corpus $CORPUS is missing; it is the source of truth and must exist"
  PASS=false
else
  SCEN_FILE="$(mktemp)"
  # Strip blank lines and `#` comments; keep tokens verbatim (trailing ws trimmed).
  sed -E 's/[[:space:]]+$//' "$CORPUS" \
    | grep -vE '^[[:space:]]*(#|$)' \
    > "$SCEN_FILE"

  SCEN_COUNT=$(grep -c . "$SCEN_FILE" || true)
  echo "    enumerated $SCEN_COUNT corpus scenario(s) from $CORPUS"

  if ! grep -qxF "$ANCHOR" "$SCEN_FILE"; then
    echo "    fail -- corpus is missing the dogfood regression anchor scenario: \"$ANCHOR\""
    PASS=false
  fi

  if [ "$SCEN_COUNT" -lt 2 ]; then
    echo "    fail -- corpus has $SCEN_COUNT scenario(s); a representative spread (>= 2, covering a second entity NOT_FOUND sender) is required"
    PASS=false
  fi

  # The harness imports the real result-senders, drives each token's NOT_FOUND
  # branch with a fake reply that captures the body, and prints that body as
  # JSON. Unknown tokens / thrown errors are surfaced explicitly so the corpus
  # cannot list a scenario the gate does not actually exercise.
  HARNESS='
import {
  sendAddScenarioStepResult,
  sendCreateScenarioResult
} from "./src/http/scenario-results.ts";
import {
  sendStepEditingResult,
  sendStepMoveResult
} from "./src/http/step-results.ts";

const token = process.argv[1];
let captured = undefined;
const reply = {
  code() { return reply; },
  header() { return reply; },
  send(body) { captured = body; return reply; }
};

const registry = {
  "step-add-scenario-not-found": () =>
    sendAddScenarioStepResult(reply, { status: "SCENARIO_NOT_FOUND" }),
  "step-edit-step-not-found": () =>
    sendStepEditingResult(reply, { status: "STEP_NOT_FOUND" }),
  "step-move-step-not-found": () =>
    sendStepMoveResult(reply, { status: "STEP_NOT_FOUND" }),
  "scenario-create-usecase-not-found": () =>
    sendCreateScenarioResult(reply, { status: "USECASE_NOT_FOUND" })
};

const run = registry[token];
if (!run) {
  console.log("__UNKNOWN_TOKEN__");
} else {
  try {
    run();
    console.log(JSON.stringify(captured));
  } catch (e) {
    console.log("__THREW__ " + String(e));
  }
}
'

  while IFS= read -r SCEN; do
    [ -z "$SCEN" ] && continue
    OUT="$(pnpm --filter @vooster/api exec tsx -e "$HARNESS" "$SCEN" 2>&1 || true)"
    if printf '%s' "$OUT" | grep -q '__UNKNOWN_TOKEN__'; then
      echo "    fail -- corpus scenario [$SCEN] is not modelled by the gate harness; add it to the registry or remove the line"
      PASS=false
    elif printf '%s' "$OUT" | grep -q '__THREW__'; then
      echo "    fail -- corpus scenario [$SCEN] threw instead of sending a response:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif printf '%s' "$OUT" | grep -q 'vspec login'; then
      echo "    fail -- not-found scenario [$SCEN] still suggests the signup recovery \`vspec login\`:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif printf '%s' "$OUT" | grep -q 'Restart signup'; then
      echo "    fail -- not-found scenario [$SCEN] still carries the \"Restart signup\" reason:"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    elif ! printf '%s' "$OUT" | grep -q 'vspec usecase show'; then
      echo "    fail -- not-found scenario [$SCEN] does not teach the real recovery (\`vspec usecase show\`):"
      printf '%s\n' "$OUT" | sed 's/^/        /'
      PASS=false
    else
      echo "    pass -- scenario [$SCEN] teaches \`vspec usecase show\`, no signup recovery"
    fi
  done < "$SCEN_FILE"

  rm -f "$SCEN_FILE"
fi

echo "[75.B2] shared problem() helper no longer ships a signup-flavored default (negative universal invariant)"
# A behaviour test only covers the senders it exercises; this single grep proves
# no other present/future problem() caller can silently inherit the signup
# recovery by omitting an explicit suggestion.
if [ ! -f "$HELPER" ]; then
  echo "    fail -- $HELPER is missing; it owns the shared problem() helper"
  PASS=false
elif grep -nE 'suggestedNextActions[[:space:]]*=.*Restart signup' "$HELPER" >/dev/null 2>&1; then
  echo "    fail -- problem()'s default suggestedNextActions still hardcodes the signup recovery in $HELPER:"
  grep -nE 'suggestedNextActions[[:space:]]*=.*Restart signup' "$HELPER" | sed 's/^/        /'
  PASS=false
else
  echo "    pass -- problem() default no longer hardcodes the signup recovery"
fi

echo "[75.C1 Gate rigor]"
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
