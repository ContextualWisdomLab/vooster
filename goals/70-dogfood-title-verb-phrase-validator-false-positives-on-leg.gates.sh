#!/usr/bin/env bash
# goals/70-dogfood-title-verb-phrase-validator-false-positives-on-leg.gates.sh
# The verb-phrase validator accepts every legitimate verb in the regression
# corpus (no closed-whitelist false positives), keeps the behaviour suites
# green, and a rejection names the offending word (locked by the suite).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="70-dogfood-title-verb-phrase-validator-false-positives-on-leg"
CORPUS="apps/api/tests/fixtures/legitimate-verb-phrase-titles.txt"
ANCHOR="Partner accepts a shared-budget invitation"
GATE_INPUTS=(
  apps/api/src/application/verb-phrases.ts
  apps/api/src/http/usecase-results.ts
  apps/api/tests/fixtures/legitimate-verb-phrase-titles.txt
  apps/api/tests/unit/application/verb-phrases.test.ts
  apps/api/tests/unit/http/usecase-results.test.ts
  goals/70-dogfood-title-verb-phrase-validator-false-positives-on-leg.md
  goals/70-dogfood-title-verb-phrase-validator-false-positives-on-leg.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[70.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[70.A2] verb-phrase + rejection-envelope behaviour suites pass (offending word named, prior titles still valid)"
if pnpm exec vitest run \
  apps/api/tests/unit/application/verb-phrases.test.ts \
  apps/api/tests/unit/http/usecase-results.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[70.B1] every title in the legitimate-verb regression corpus is accepted by titleLooksLikeVerbPhrase"
# Universal claim -> enumerate the corpus from source of truth and loop the real
# validator over each title. No single-case cheat.
if [ ! -f "$CORPUS" ]; then
  echo "    fail -- corpus $CORPUS is missing; it is the source of truth and must exist"
  PASS=false
else
  TITLES_FILE="$(mktemp)"
  # Strip blank lines and `#` comments; keep titles verbatim.
  sed -E 's/[[:space:]]+$//' "$CORPUS" \
    | grep -vE '^[[:space:]]*(#|$)' \
    > "$TITLES_FILE"

  TITLE_COUNT=$(grep -c . "$TITLES_FILE" || true)
  echo "    enumerated $TITLE_COUNT corpus title(s) from $CORPUS"

  if ! grep -qxF "$ANCHOR" "$TITLES_FILE"; then
    echo "    fail -- corpus is missing the dogfood regression anchor: \"$ANCHOR\""
    PASS=false
  fi

  if [ "$TITLE_COUNT" -lt 6 ]; then
    echo "    fail -- corpus has $TITLE_COUNT title(s); a representative spread (>= 6) of legitimate verbs is required"
    PASS=false
  fi

  if [ "$TITLE_COUNT" -gt 0 ]; then
    REJECTED="$(pnpm --filter @vooster/api exec tsx -e '
import { titleLooksLikeVerbPhrase } from "./src/application/verb-phrases.ts";
import { readFileSync } from "node:fs";
const titles = readFileSync(process.argv[1], "utf8")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);
for (const t of titles) {
  if (!titleLooksLikeVerbPhrase(t)) console.log(t);
}
' "$TITLES_FILE" 2>/dev/null)"
    if [ -z "$REJECTED" ]; then
      echo "    pass -- all $TITLE_COUNT corpus title(s) accepted"
    else
      echo "    fail -- the validator still rejects legitimate verb phrases:"
      printf '%s\n' "$REJECTED" | sed 's/^/      /'
      PASS=false
    fi
  fi
  rm -f "$TITLES_FILE"
fi

echo "[70.C1 Gate rigor]"
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
