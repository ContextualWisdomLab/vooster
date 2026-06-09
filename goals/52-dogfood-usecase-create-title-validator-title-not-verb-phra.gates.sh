#!/usr/bin/env bash
# goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.gates.sh
# The shipped AI guide ships no self-contradicting `usecase create` example:
# every create-example title is accepted by the validator and none is forced.
# The rejection envelope is self-teaching (locked by the behavior suite).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="52-dogfood-usecase-create-title-validator-title-not-verb-phra"
GUIDE="apps/api/src/application/ai-guide.ts"
GATE_INPUTS=(
  apps/api/src/application/ai-guide.ts
  apps/api/src/application/verb-phrases.ts
  apps/api/src/http/usecase-results.ts
  apps/api/tests/unit/http/usecase-results.test.ts
  apps/api/tests/unit/application/verb-phrases.test.ts
  goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.md
  goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[52.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[52.A2] self-teaching envelope + verb-phrase suites pass"
if pnpm exec vitest run \
  apps/api/tests/unit/http/usecase-results.test.ts \
  apps/api/tests/unit/application/verb-phrases.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[52.B1] every 'usecase create' example title in the guide is accepted by titleLooksLikeVerbPhrase"
# Universal claim -> enumerate every create command from the guide (source of
# truth) and loop the real validator over each title. No single-case cheat.
TITLES_FILE="$(mktemp)"
grep -oE 'usecase create --title "[^"]*"' "$GUIDE" \
  | sed -E 's/.*--title "([^"]*)".*/\1/' \
  > "$TITLES_FILE"

TITLE_COUNT=0
while IFS= read -r _t; do
  [ -n "$_t" ] && TITLE_COUNT=$((TITLE_COUNT + 1))
done < "$TITLES_FILE"
echo "    enumerated $TITLE_COUNT 'usecase create' example title(s) from $GUIDE"

if [ "$TITLE_COUNT" -eq 0 ]; then
  echo "    fail -- no create-example titles found; the guide source is the source of truth and must ship at least one"
  PASS=false
else
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
    echo "    pass -- all $TITLE_COUNT guide create-example title(s) accepted"
  else
    echo "    fail -- the guide ships create examples the validator rejects:"
    printf '%s\n' "$REJECTED" | sed 's/^/      /'
    PASS=false
  fi
fi
rm -f "$TITLES_FILE"

echo "[52.B2] no 'usecase create' example in the guide bypasses the validator with --force"
# Negative universal invariant: the forced workaround appears nowhere in the
# shipped guide. A single grep guards the whole file.
if FORCED="$(grep -nE 'usecase create.*--force' "$GUIDE")"; then
  echo "    fail -- the guide still teaches the --force workaround:"
  printf '%s\n' "$FORCED" | sed 's/^/      /'
  PASS=false
else
  echo "    pass -- no forced create example in the guide"
fi

echo "[52.C1 Gate rigor]"
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
