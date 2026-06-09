#!/usr/bin/env bash
# goals/49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na.gates.sh
# Verb-phrase title heuristic accepts finite-verb (incl. subject-first) titles,
# emits sane suggestions, and accepts every title in the repo's own UC corpus.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na"
GATE_INPUTS=(
  apps/api/src/application/verb-phrases.ts
  apps/api/src/application/usecases.ts
  apps/api/tests/unit/application/verb-phrases.test.ts
  apps/api/tests/unit/application/usecases.test.ts
  docs/usecases
  goals/49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na.md
  goals/49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[49.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[49.A2] verb-phrase + authoring behavior suites pass (finite-verb accepted, sane suggestions)"
if pnpm exec vitest run \
  apps/api/tests/unit/application/verb-phrases.test.ts \
  apps/api/tests/unit/application/usecases.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[49.B1] every UC title in docs/usecases is accepted by titleLooksLikeVerbPhrase"
# Universal claim -> enumerate the corpus from source of truth and loop.
# (find + xargs are the iteration constructs; the heuristic is pure, so we
#  evaluate it once over the whole enumerated list via the API's tsx runtime.)
TITLES_FILE="$(mktemp)"
find docs/usecases -maxdepth 1 -name 'UC-*.md' -type f -print0 \
  | xargs -0 grep -hE '^title:[[:space:]]' \
  | sed -E 's/^title:[[:space:]]*//' \
  > "$TITLES_FILE"
TITLE_COUNT=$(grep -c . "$TITLES_FILE" || true)
echo "    enumerated $TITLE_COUNT corpus titles from docs/usecases/UC-*.md"

if [ "$TITLE_COUNT" -eq 0 ]; then
  echo "    fail -- no UC titles found; source of truth is empty"
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
    echo "    pass -- all $TITLE_COUNT corpus titles accepted"
  else
    echo "    fail -- the heuristic rejects the project's own UC titles:"
    printf '%s\n' "$REJECTED" | sed 's/^/      /'
    PASS=false
  fi
fi
rm -f "$TITLES_FILE"

echo "[49.C1 Gate rigor]"
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
